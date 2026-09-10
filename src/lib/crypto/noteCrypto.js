/**
 * BurnNote Cryptographic Engine
 * 
 * Implements client-side Zero-Knowledge End-to-End Encryption (E2EE):
 * - AES-256-GCM for note encryption/decryption
 * - PBKDF2-HMAC-SHA-256 (600,000 iterations) for password key derivation
 * - 256-bit CSPRNG tokens
 * - Domain-separated subkeys for encryption (K_enc) and server verification (K_auth)
 */

const PBKDF2_ITERATIONS = 600000;
const SALT_BYTE_LENGTH = 16;
const IV_BYTE_LENGTH = 12;
const TAG_BYTE_LENGTH = 16;

/**
 * Convert an ArrayBuffer or Uint8Array to a hex string
 * @param {ArrayBuffer|Uint8Array} buffer
 * @returns {string}
 */
export function bufferToHex(buffer) {
	const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

/**
 * Convert a hex string to Uint8Array
 * @param {string} hex
 * @returns {Uint8Array}
 */
export function hexToBuffer(hex) {
	if (!hex || hex.length % 2 !== 0) {
		throw new Error('Invalid hex string');
	}
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < hex.length; i += 2) {
		bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
	}
	return bytes;
}

/**
 * Convert Uint8Array or ArrayBuffer to base64
 * @param {ArrayBuffer|Uint8Array} buffer
 * @returns {string}
 */
export function bufferToBase64(buffer) {
	const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
	let binary = '';
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

/**
 * Convert base64 to Uint8Array
 * @param {string} base64
 * @returns {Uint8Array}
 */
export function base64ToBuffer(base64) {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

/**
 * Computes SHA-256 hash of a string or buffer, returned as hex
 * @param {string|Uint8Array} input
 * @returns {Promise<string>}
 */
export async function sha256Hex(input) {
	const data = typeof input === 'string' ? new TextEncoder().encode(input) : input;
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	return bufferToHex(hashBuffer);
}

/**
 * Generates a 256-bit cryptographically secure random token (64 hex characters)
 * @returns {string}
 */
export function generateToken() {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return bufferToHex(bytes);
}

/**
 * Generates a random secure password for convenience
 * @param {number} length
 * @returns {string}
 */
export function generateSecurePassword(length = 20) {
	const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+';
	const bytes = new Uint8Array(length);
	crypto.getRandomValues(bytes);
	let result = '';
	for (let i = 0; i < length; i++) {
		result += charset[bytes[i] % charset.length];
	}
	return result;
}

/**
 * Derives master key material and domain-separated keys:
 * - K_enc: for AES-256-GCM encryption
 * - K_auth: proof of password knowledge for server authorization check
 * 
 * @param {string} password
 * @param {Uint8Array} saltBytes
 * @returns {Promise<{ encKey: CryptoKey, authVerifier: string, authHash: string }>}
 */
async function deriveKeys(password, saltBytes) {
	const encoder = new TextEncoder();
	const passKeyMaterial = await crypto.subtle.importKey(
		'raw',
		encoder.encode(password),
		{ name: 'PBKDF2' },
		false,
		['deriveBits', 'deriveKey']
	);

	// Derive 512 bits total from PBKDF2
	const derivedBits = await crypto.subtle.deriveBits(
		{
			name: 'PBKDF2',
			salt: saltBytes,
			iterations: PBKDF2_ITERATIONS,
			hash: 'SHA-256'
		},
		passKeyMaterial,
		512
	);

	const encKeyBytes = new Uint8Array(derivedBits, 0, 32);      // First 256 bits for AES-256
	const authKeyBytes = new Uint8Array(derivedBits, 32, 32);    // Next 256 bits for Auth Verifier

	const encKey = await crypto.subtle.importKey(
		'raw',
		encKeyBytes,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt']
	);

	const authVerifier = bufferToHex(authKeyBytes);
	const authHash = await sha256Hex(authVerifier);

	return { encKey, authVerifier, authHash };
}

/**
 * Encrypt a plaintext note using AES-256-GCM and derived password keys
 * 
 * @param {string} plaintext
 * @param {string} password
 * @returns {Promise<{
 *   token: string,
 *   tokenHash: string,
 *   encryptedContent: string,
 *   iv: string,
 *   authTag: string,
 *   salt: string,
 *   authHash: string
 * }>}
 */
export async function encryptNote(plaintext, password) {
	if (!plaintext || typeof plaintext !== 'string') {
		throw new Error('Note content cannot be empty');
	}
	if (!password || typeof password !== 'string') {
		throw new Error('Password is required');
	}

	const token = generateToken();
	const tokenHash = await sha256Hex(token);

	// Generate CSPRNG salt & IV
	const saltBytes = new Uint8Array(SALT_BYTE_LENGTH);
	crypto.getRandomValues(saltBytes);

	const ivBytes = new Uint8Array(IV_BYTE_LENGTH);
	crypto.getRandomValues(ivBytes);

	const { encKey, authHash } = await deriveKeys(password, saltBytes);

	const encodedPlaintext = new TextEncoder().encode(plaintext);

	// WebCrypto AES-GCM output is ciphertext + 16-byte authentication tag
	const encryptedBuffer = await crypto.subtle.encrypt(
		{
			name: 'AES-GCM',
			iv: ivBytes,
			tagLength: TAG_BYTE_LENGTH * 8
		},
		encKey,
		encodedPlaintext
	);

	const encryptedBytes = new Uint8Array(encryptedBuffer);
	const ciphertextBytes = encryptedBytes.slice(0, encryptedBytes.length - TAG_BYTE_LENGTH);
	const tagBytes = encryptedBytes.slice(encryptedBytes.length - TAG_BYTE_LENGTH);

	return {
		token,
		tokenHash,
		encryptedContent: bufferToBase64(ciphertextBytes),
		iv: bufferToHex(ivBytes),
		authTag: bufferToHex(tagBytes),
		salt: bufferToHex(saltBytes),
		authHash
	};
}

/**
 * Computes the auth verifier for password submission to the server
 * 
 * @param {string} password
 * @param {string} saltHex
 * @returns {Promise<string>} authVerifier hex string
 */
export async function computeAuthVerifier(password, saltHex) {
	const saltBytes = hexToBuffer(saltHex);
	const { authVerifier } = await deriveKeys(password, saltBytes);
	return authVerifier;
}

/**
 * Decrypts an encrypted note using the user password
 * 
 * @param {{
 *   encryptedContent: string,
 *   iv: string,
 *   authTag: string,
 *   salt: string
 * }} notePackage
 * @param {string} password
 * @returns {Promise<string>} Plaintext note content
 */
export async function decryptNote(notePackage, password) {
	const { encryptedContent, iv, authTag, salt } = notePackage;

	const saltBytes = hexToBuffer(salt);
	const ivBytes = hexToBuffer(iv);
	const ciphertextBytes = base64ToBuffer(encryptedContent);
	const tagBytes = hexToBuffer(authTag);

	// Concatenate ciphertext and auth tag for WebCrypto AES-GCM
	const combinedBuffer = new Uint8Array(ciphertextBytes.length + tagBytes.length);
	combinedBuffer.set(ciphertextBytes, 0);
	combinedBuffer.set(tagBytes, ciphertextBytes.length);

	const { encKey } = await deriveKeys(password, saltBytes);

	const decryptedBuffer = await crypto.subtle.decrypt(
		{
			name: 'AES-GCM',
			iv: ivBytes,
			tagLength: TAG_BYTE_LENGTH * 8
		},
		encKey,
		combinedBuffer
	);

	return new TextDecoder().decode(decryptedBuffer);
}
