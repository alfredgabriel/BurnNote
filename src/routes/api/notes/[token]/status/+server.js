import { json } from '@sveltejs/kit';
import { getNoteStatus } from '$lib/server/db.js';
import crypto from 'node:crypto';

export async function GET({ params }) {
	const { token } = params;

	if (!token || typeof token !== 'string' || !/^[0-9a-f]{64}$/i.test(token)) {
		return json({ error: 'This BurnNote is no longer available.' }, { status: 404 });
	}

	const tokenHash = crypto.createHash('sha256').update(token.toLowerCase()).digest('hex');
	const noteStatus = getNoteStatus(tokenHash);

	if (!noteStatus) {
		return json({ error: 'This BurnNote is no longer available.' }, { status: 404 });
	}

	// Only return the public cryptographic parameters needed for client key derivation
	return json({
		exists: true,
		salt: noteStatus.salt,
		burnOnFailedAttempt: noteStatus.burnOnFailedAttempt,
		expiresAt: noteStatus.expiresAt
	});
}
