import { json } from '@sveltejs/kit';
import { consumeNoteAtomic } from '$lib/server/db.js';
import { checkRateLimit } from '$lib/server/ratelimit.js';
import crypto from 'node:crypto';

export async function POST({ params, request, getClientAddress }) {
	const { token } = params;

	// Rate limiting on consumption attempts to prevent rapid brute-force attempts
	const clientIp = getClientAddress ? getClientAddress() : '127.0.0.1';
	const rateLimit = checkRateLimit(clientIp, 'consume');
	if (!rateLimit.allowed) {
		return json(
			{ error: 'Too many requests. Please try again later.' },
			{
				status: 429,
				headers: {
					'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000))
				}
			}
		);
	}

	if (!token || typeof token !== 'string' || !/^[0-9a-f]{64}$/i.test(token)) {
		return json({ error: 'This BurnNote is no longer available.' }, { status: 404 });
	}

	try {
		const body = await request.json();
		const { authVerifier } = body;

		if (!authVerifier || typeof authVerifier !== 'string' || !/^[0-9a-f]{64}$/i.test(authVerifier)) {
			return json({ error: 'This BurnNote is no longer available.' }, { status: 404 });
		}

		const tokenHash = crypto.createHash('sha256').update(token.toLowerCase()).digest('hex');

		// Atomic consumption: burns note if verifier is wrong (or on successful read)
		const result = consumeNoteAtomic(tokenHash, authVerifier.toLowerCase());

		if (!result.success) {
			// Per spec: return generic error message for privacy
			return json({ error: 'This BurnNote is no longer available.' }, { status: 404 });
		}

		return json({
			success: true,
			payload: result.payload
		});
	} catch {
		return json({ error: 'This BurnNote is no longer available.' }, { status: 404 });
	}
}
