import { describe, it, expect, beforeEach } from 'vitest';
import { getDb, insertNote, getNoteStatus, consumeNoteAtomic, cleanupExpiredNotes } from './db.js';
import { encryptNote, decryptNote, computeAuthVerifier, sha256Hex } from '$lib/crypto/noteCrypto.js';
import crypto from 'node:crypto';

describe('Comprehensive Security & Attack Vectors Test Suite', () => {
	beforeEach(() => {
		const db = getDb();
		db.prepare('DELETE FROM notes').run();
		db.prepare('DELETE FROM rate_limits').run();
	});

	it('XSS payload resistance: note content is treated purely as raw data', async () => {
		const xssPayload = '<script>alert("XSS")</script><img src=x onerror=alert(1)>';
		const password = 'PasswordForXssTest123!';

		const encryptedPkg = await encryptNote(xssPayload, password);

		// Plaintext must not exist anywhere in encrypted payload
		expect(encryptedPkg.encryptedContent).not.toContain('<script>');
		expect(encryptedPkg.encryptedContent).not.toContain('alert');

		// Insert into database
		insertNote({
			tokenHash: encryptedPkg.tokenHash,
			encryptedContent: encryptedPkg.encryptedContent,
			iv: encryptedPkg.iv,
			authTag: encryptedPkg.authTag,
			salt: encryptedPkg.salt,
			authHash: encryptedPkg.authHash,
			expiresInSeconds: 3600
		});

		// Consume and decrypt
		const authVerifier = await computeAuthVerifier(password, encryptedPkg.salt);
		const consumeResult = consumeNoteAtomic(encryptedPkg.tokenHash, authVerifier);
		expect(consumeResult.success).toBe(true);

		const decrypted = await decryptNote(consumeResult.payload, password);
		expect(decrypted).toBe(xssPayload);
	});

	it('SQL Injection resistance: injection strings in tokenHash, verifier, or fields cannot bypass queries', () => {
		const sqlInjectionToken = "' OR 1=1 --";
		const sqlInjectionHash = crypto.createHash('sha256').update(sqlInjectionToken).digest('hex');

		// Attempt get status with injection string
		const status = getNoteStatus(sqlInjectionToken);
		expect(status).toBeNull();

		// Attempt consume with SQL injection
		const consume = consumeNoteAtomic(sqlInjectionToken, "' OR '1'='1");
		expect(consume.success).toBe(false);

		// Even if note inserted with valid hash, malicious verifier string cannot cause SQL syntax error
		insertNote({
			tokenHash: sqlInjectionHash,
			encryptedContent: 'safe_data',
			iv: 'iv_hex',
			authTag: 'tag_hex',
			salt: 'salt_hex',
			authHash: 'valid_auth_hash',
			expiresInSeconds: 3600
		});

		const attackConsume = consumeNoteAtomic(sqlInjectionHash, "'; DROP TABLE notes; --");
		expect(attackConsume.success).toBe(false);

		// Table must still exist and be intact
		const db = getDb();
		const count = db.prepare('SELECT count(*) as count FROM notes').get();
		// The note should have been burned due to incorrect password attempt!
		expect(count.count).toBe(0);
	});

	it('Concurrency: Simultaneous race conditions result in exactly ONE successful read', async () => {
		const secretText = 'ONE_TIME_ONLY_SECRET';
		const password = 'ConcurrencyPassword123!';

		const encryptedPkg = await encryptNote(secretText, password);

		insertNote({
			tokenHash: encryptedPkg.tokenHash,
			encryptedContent: encryptedPkg.encryptedContent,
			iv: encryptedPkg.iv,
			authTag: encryptedPkg.authTag,
			salt: encryptedPkg.salt,
			authHash: encryptedPkg.authHash,
			expiresInSeconds: 3600
		});

		const authVerifier = await computeAuthVerifier(password, encryptedPkg.salt);

		// Simulate 10 simultaneous race-condition requests to consume the same note
		const attempts = Array.from({ length: 10 }).map(() =>
			new Promise((resolve) => {
				setTimeout(() => {
					try {
						const res = consumeNoteAtomic(encryptedPkg.tokenHash, authVerifier);
						resolve(res.success);
					} catch {
						resolve(false);
					}
				}, Math.floor(Math.random() * 5));
			})
		);

		const results = await Promise.all(attempts);
		const successfulAttempts = results.filter((s) => s === true);

		// EXACTLY ONE request must succeed!
		expect(successfulAttempts.length).toBe(1);

		// All 9 other attempts must have failed
		const failedAttempts = results.filter((s) => s === false);
		expect(failedAttempts.length).toBe(9);

		// Note must be completely gone
		expect(getNoteStatus(encryptedPkg.tokenHash)).toBeNull();
	});

	it('Burn-on-fail prevents subsequent access with the correct password', async () => {
		const secret = 'TOP_SECRET_CREDENTIALS';
		const correctPassword = 'MySecretPassword123!';
		const wrongPassword = 'WrongPasswordAttempt!';

		const pkg = await encryptNote(secret, correctPassword);

		insertNote({
			tokenHash: pkg.tokenHash,
			encryptedContent: pkg.encryptedContent,
			iv: pkg.iv,
			authTag: pkg.authTag,
			salt: pkg.salt,
			authHash: pkg.authHash,
			burnOnFailedAttempt: true,
			expiresInSeconds: 3600
		});

		// Attacker attempts to guess password
		const wrongVerifier = await computeAuthVerifier(wrongPassword, pkg.salt);
		const attackResult = consumeNoteAtomic(pkg.tokenHash, wrongVerifier);
		expect(attackResult.success).toBe(false);

		// Legitimate user now tries with CORRECT password
		const correctVerifier = await computeAuthVerifier(correctPassword, pkg.salt);
		const legitimateResult = consumeNoteAtomic(pkg.tokenHash, correctVerifier);

		// Must fail because note was permanently destroyed on the first failed attempt!
		expect(legitimateResult.success).toBe(false);
		expect(getNoteStatus(pkg.tokenHash)).toBeNull();
	});
});
