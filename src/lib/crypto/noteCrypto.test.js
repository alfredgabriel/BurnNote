import { describe, it, expect } from 'vitest';
import {
	generateToken,
	generateSecurePassword,
	encryptNote,
	decryptNote,
	computeAuthVerifier,
	sha256Hex
} from './noteCrypto.js';

describe('noteCrypto', () => {
	it('generates a 256-bit cryptographically secure token', () => {
		const token1 = generateToken();
		const token2 = generateToken();

		expect(token1).toHaveLength(64); // 32 bytes hex = 64 characters
		expect(token2).toHaveLength(64);
		expect(token1).not.toBe(token2);
		expect(/^[0-9a-f]{64}$/.test(token1)).toBe(true);
	});

	it('generates secure random passwords', () => {
		const p1 = generateSecurePassword(24);
		const p2 = generateSecurePassword(24);
		expect(p1).toHaveLength(24);
		expect(p2).toHaveLength(24);
		expect(p1).not.toBe(p2);
	});

	it('encrypts and decrypts note accurately with the correct password', async () => {
		const secretText = 'CONFIDENTIAL: API_KEY=sk_test_1234567890abcdef\nSecond line secrets.';
		const password = 'SuperSecurePassword!2026';

		const encryptedPkg = await encryptNote(secretText, password);

		expect(encryptedPkg.token).toHaveLength(64);
		expect(encryptedPkg.tokenHash).toHaveLength(64);
		expect(encryptedPkg.encryptedContent).toBeTruthy();
		expect(encryptedPkg.encryptedContent).not.toContain(secretText);
		expect(encryptedPkg.iv).toHaveLength(24); // 12 bytes = 24 hex
		expect(encryptedPkg.authTag).toHaveLength(32); // 16 bytes = 32 hex
		expect(encryptedPkg.salt).toHaveLength(32); // 16 bytes = 32 hex
		expect(encryptedPkg.authHash).toHaveLength(64);

		// Compute auth verifier
		const authVerifier = await computeAuthVerifier(password, encryptedPkg.salt);
		const computedHash = await sha256Hex(authVerifier);
		expect(computedHash).toBe(encryptedPkg.authHash);

		// Decrypt note
		const decrypted = await decryptNote(encryptedPkg, password);
		expect(decrypted).toBe(secretText);
	});

	it('fails to decrypt if the wrong password is provided', async () => {
		const secretText = 'Super sensitive database credentials';
		const correctPassword = 'RightPassword123';
		const wrongPassword = 'WrongPassword456';

		const encryptedPkg = await encryptNote(secretText, correctPassword);

		// Verifier should not match
		const wrongVerifier = await computeAuthVerifier(wrongPassword, encryptedPkg.salt);
		const wrongVerifierHash = await sha256Hex(wrongVerifier);
		expect(wrongVerifierHash).not.toBe(encryptedPkg.authHash);

		// Decryption should throw
		await expect(decryptNote(encryptedPkg, wrongPassword)).rejects.toThrow();
	});
});
