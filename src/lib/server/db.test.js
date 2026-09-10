import { describe, it, expect, beforeEach } from 'vitest';
import { getDb, insertNote, getNoteStatus, consumeNoteAtomic, cleanupExpiredNotes } from './db.js';
import crypto from 'node:crypto';

describe('db.js - SQLite atomic operations', () => {
	beforeEach(() => {
		const db = getDb();
		db.prepare('DELETE FROM notes').run();
		db.prepare('DELETE FROM rate_limits').run();
	});

	it('inserts and retrieves note metadata without exposing encrypted content', () => {
		const tokenHash = 'testtokenhash1234567890abcdef1234567890abcdef1234567890abcdef12';
		const authVerifier = 'myauthverifierhexstring';
		const authHash = crypto.createHash('sha256').update(authVerifier).digest('hex');

		insertNote({
			tokenHash,
			encryptedContent: 'ENCRYPTED_BASE64_DATA',
			iv: 'iv_hex',
			authTag: 'tag_hex',
			salt: 'salt_hex',
			authHash,
			burnOnFailedAttempt: true,
			expiresInSeconds: 3600
		});

		const status = getNoteStatus(tokenHash);
		expect(status).not.toBeNull();
		expect(status.salt).toBe('salt_hex');
		expect(status.burnOnFailedAttempt).toBe(true);
		expect(status.encryptedContent).toBeUndefined();
	});

	it('successfully consumes a note and permanently destroys it immediately', () => {
		const tokenHash = 'testtokenhash_consume_success';
		const authVerifier = 'valid_verifier_123';
		const authHash = crypto.createHash('sha256').update(authVerifier).digest('hex');

		insertNote({
			tokenHash,
			encryptedContent: 'SECRET_PAYLOAD',
			iv: 'iv123',
			authTag: 'tag123',
			salt: 'salt123',
			authHash,
			burnOnFailedAttempt: true,
			expiresInSeconds: 3600
		});

		// First consumption: succeeds
		const result = consumeNoteAtomic(tokenHash, authVerifier);
		expect(result.success).toBe(true);
		expect(result.payload.encryptedContent).toBe('SECRET_PAYLOAD');

		// Second consumption attempt: fails because note is destroyed
		const secondAttempt = consumeNoteAtomic(tokenHash, authVerifier);
		expect(secondAttempt.success).toBe(false);

		// Status check: note no longer exists
		expect(getNoteStatus(tokenHash)).toBeNull();
	});

	it('destroys note immediately when an incorrect password verifier is entered', () => {
		const tokenHash = 'testtokenhash_burn_on_fail';
		const authVerifier = 'correct_verifier';
		const authHash = crypto.createHash('sha256').update(authVerifier).digest('hex');

		insertNote({
			tokenHash,
			encryptedContent: 'SECRET_PAYLOAD',
			iv: 'iv123',
			authTag: 'tag123',
			salt: 'salt123',
			authHash,
			burnOnFailedAttempt: true,
			expiresInSeconds: 3600
		});

		// Attempt with incorrect verifier: fails
		const failResult = consumeNoteAtomic(tokenHash, 'wrong_verifier');
		expect(failResult.success).toBe(false);

		// Subsequent attempt with the CORRECT verifier: must fail because it was burned!
		const correctResultAfterBurn = consumeNoteAtomic(tokenHash, authVerifier);
		expect(correctResultAfterBurn.success).toBe(false);

		// Status check: note is gone
		expect(getNoteStatus(tokenHash)).toBeNull();
	});

	it('handles expired notes by rejecting access and deleting them', () => {
		const tokenHash = 'expired_note_hash';
		const authVerifier = 'verifier';
		const authHash = crypto.createHash('sha256').update(authVerifier).digest('hex');

		insertNote({
			tokenHash,
			encryptedContent: 'EXPIRED_PAYLOAD',
			iv: 'iv',
			authTag: 'tag',
			salt: 'salt',
			authHash,
			burnOnFailedAttempt: true,
			expiresInSeconds: -10 // expired in the past
		});

		// Status check fails and deletes note
		expect(getNoteStatus(tokenHash)).toBeNull();

		// Consumption fails
		const result = consumeNoteAtomic(tokenHash, authVerifier);
		expect(result.success).toBe(false);
	});

	it('cleanupExpiredNotes deletes old records', () => {
		const authHash = crypto.createHash('sha256').update('v').digest('hex');
		insertNote({
			tokenHash: 'exp1',
			encryptedContent: 'data',
			iv: 'iv',
			authTag: 'tag',
			salt: 'salt',
			authHash,
			expiresInSeconds: -100
		});
		insertNote({
			tokenHash: 'exp2',
			encryptedContent: 'data',
			iv: 'iv',
			authTag: 'tag',
			salt: 'salt',
			authHash,
			expiresInSeconds: -200
		});

		const deleted = cleanupExpiredNotes();
		expect(deleted).toBeGreaterThanOrEqual(2);
	});
});
