import { json } from '@sveltejs/kit';
import { insertNote } from '$lib/server/db.js';
import { checkRateLimit } from '$lib/server/ratelimit.js';

const ALLOWED_EXPIRATIONS = [600, 3600, 86400, 604800]; // 10m, 1h, 24h, 7d
const MAX_ENCRYPTED_LENGTH = 1024 * 512; // 512 KB

export async function POST({ request, getClientAddress }) {
	// Apply rate limiting
	const clientIp = getClientAddress ? getClientAddress() : '127.0.0.1';
	const rateLimit = checkRateLimit(clientIp, 'create');
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

	try {
		let body;
		try {
			body = await request.json();
		} catch {
			return json({ error: 'Invalid JSON body' }, { status: 400 });
		}

		const {
			tokenHash,
			encryptedContent,
			iv,
			authTag,
			salt,
			authHash,
			expiresInSeconds = 86400,
			burnOnFailedAttempt = true
		} = body;

		// Input validation
		if (!tokenHash || typeof tokenHash !== 'string' || !/^[0-9a-f]{64}$/i.test(tokenHash)) {
			return json({ error: 'Invalid token hash' }, { status: 400 });
		}

		if (!encryptedContent || typeof encryptedContent !== 'string' || encryptedContent.length > MAX_ENCRYPTED_LENGTH) {
			return json({ error: 'Invalid or oversized note content' }, { status: 400 });
		}

		if (!iv || typeof iv !== 'string' || !/^[0-9a-f]{24}$/i.test(iv)) {
			return json({ error: 'Invalid initialization vector' }, { status: 400 });
		}

		if (!authTag || typeof authTag !== 'string' || !/^[0-9a-f]{32}$/i.test(authTag)) {
			return json({ error: 'Invalid authentication tag' }, { status: 400 });
		}

		if (!salt || typeof salt !== 'string' || !/^[0-9a-f]{32}$/i.test(salt)) {
			return json({ error: 'Invalid salt' }, { status: 400 });
		}

		if (!authHash || typeof authHash !== 'string' || !/^[0-9a-f]{64}$/i.test(authHash)) {
			return json({ error: 'Invalid authentication hash' }, { status: 400 });
		}

		const expiration = Number(expiresInSeconds);
		if (!ALLOWED_EXPIRATIONS.includes(expiration)) {
			return json({ error: 'Invalid expiration time' }, { status: 400 });
		}

		const result = insertNote({
			tokenHash: tokenHash.toLowerCase(),
			encryptedContent,
			iv: iv.toLowerCase(),
			authTag: authTag.toLowerCase(),
			salt: salt.toLowerCase(),
			authHash: authHash.toLowerCase(),
			burnOnFailedAttempt: Boolean(burnOnFailedAttempt),
			expiresInSeconds: expiration
		});

		return json(
			{
				success: true,
				expiresAt: result.expiresAt
			},
			{ status: 201 }
		);
	} catch {
		return json({ error: 'Could not create note' }, { status: 500 });
	}
}
