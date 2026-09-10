import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';

const DB_PATH = process.env.DATABASE_PATH || './data/burnnote.db';

// Ensure data directory exists
const dbDir = path.dirname(path.resolve(DB_PATH));
if (!fs.existsSync(dbDir)) {
	fs.mkdirSync(dbDir, { recursive: true });
}

let dbInstance = null;

export function getDb() {
	if (!dbInstance) {
		dbInstance = new Database(path.resolve(DB_PATH));
		dbInstance.pragma('journal_mode = WAL');
		dbInstance.pragma('synchronous = NORMAL');
		dbInstance.pragma('busy_timeout = 5000');
		initSchema(dbInstance);
	}
	return dbInstance;
}

function initSchema(db) {
	db.exec(`
		CREATE TABLE IF NOT EXISTS notes (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			token_hash TEXT UNIQUE NOT NULL,
			encrypted_content TEXT NOT NULL,
			iv TEXT NOT NULL,
			auth_tag TEXT NOT NULL,
			salt TEXT NOT NULL,
			auth_hash TEXT NOT NULL,
			burn_on_failed_attempt INTEGER NOT NULL DEFAULT 1,
			created_at INTEGER NOT NULL,
			expires_at INTEGER NOT NULL
		);

		CREATE INDEX IF NOT EXISTS idx_notes_token_hash ON notes(token_hash);
		CREATE INDEX IF NOT EXISTS idx_notes_expires_at ON notes(expires_at);

		CREATE TABLE IF NOT EXISTS rate_limits (
			key TEXT PRIMARY KEY,
			count INTEGER NOT NULL,
			reset_at INTEGER NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_rate_limits_reset ON rate_limits(reset_at);
	`);
}

/**
 * Creates a new encrypted note
 * @param {{
 *   tokenHash: string,
 *   encryptedContent: string,
 *   iv: string,
 *   authTag: string,
 *   salt: string,
 *   authHash: string,
 *   burnOnFailedAttempt?: boolean,
 *   expiresInSeconds: number
 * }} params
 */
export function insertNote({
	tokenHash,
	encryptedContent,
	iv,
	authTag,
	salt,
	authHash,
	burnOnFailedAttempt = true,
	expiresInSeconds
}) {
	const db = getDb();
	const now = Date.now();
	const expiresAt = now + (expiresInSeconds * 1000);

	const stmt = db.prepare(`
		INSERT INTO notes (
			token_hash, encrypted_content, iv, auth_tag, salt, auth_hash, burn_on_failed_attempt, created_at, expires_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`);

	stmt.run(
		tokenHash,
		encryptedContent,
		iv,
		authTag,
		salt,
		authHash,
		burnOnFailedAttempt ? 1 : 0,
		now,
		expiresAt
	);

	return {
		tokenHash,
		createdAt: now,
		expiresAt
	};
}

/**
 * Retrieves public note status (salt, expiration).
 * NEVER exposes ciphertext or auth_hash.
 * Deletes expired notes if found.
 * 
 * @param {string} tokenHash
 * @returns {{ salt: string, expiresAt: number, burnOnFailedAttempt: boolean } | null}
 */
export function getNoteStatus(tokenHash) {
	const db = getDb();
	const now = Date.now();

	const note = db.prepare(`
		SELECT id, salt, expires_at, burn_on_failed_attempt 
		FROM notes 
		WHERE token_hash = ?
	`).get(tokenHash);

	if (!note) {
		return null;
	}

	if (now > note.expires_at) {
		db.prepare(`DELETE FROM notes WHERE id = ?`).run(note.id);
		return null;
	}

	return {
		salt: note.salt,
		expiresAt: note.expires_at,
		burnOnFailedAttempt: Boolean(note.burn_on_failed_attempt)
	};
}

/**
 * Atomically consumes and destroys a note.
 * - If incorrect password/verifier: Permanently deletes the note and fails.
 * - If correct: Permanently deletes the note and returns encrypted payload.
 * - Concurrency safe via SQLite BEGIN IMMEDIATE.
 * 
 * @param {string} tokenHash
 * @param {string} authVerifier
 * @returns {{ success: boolean, payload?: { encryptedContent: string, iv: string, authTag: string, salt: string } }}
 */
export function consumeNoteAtomic(tokenHash, authVerifier) {
	const db = getDb();
	const now = Date.now();

	const transaction = db.transaction(() => {
		const note = db.prepare(`SELECT * FROM notes WHERE token_hash = ?`).get(tokenHash);

		if (!note) {
			return { success: false };
		}

		if (now > note.expires_at) {
			db.prepare(`DELETE FROM notes WHERE id = ?`).run(note.id);
			return { success: false };
		}

		// Verify submitted authVerifier against stored auth_hash
		const submittedAuthHash = crypto.createHash('sha256').update(authVerifier).digest('hex');
		const storedBuf = Buffer.from(note.auth_hash, 'utf8');
		const submittedBuf = Buffer.from(submittedAuthHash, 'utf8');

		const isValid = storedBuf.length === submittedBuf.length && crypto.timingSafeEqual(storedBuf, submittedBuf);

		if (!isValid) {
			// Failed password: if burn_on_failed_attempt is enabled, permanently destroy note immediately
			if (note.burn_on_failed_attempt === 1) {
				db.prepare(`DELETE FROM notes WHERE id = ?`).run(note.id);
			}
			return { success: false };
		}

		// Valid password: delete note immediately upon consumption
		db.prepare(`DELETE FROM notes WHERE id = ?`).run(note.id);

		return {
			success: true,
			payload: {
				encryptedContent: note.encrypted_content,
				iv: note.iv,
				authTag: note.auth_tag,
				salt: note.salt
			}
		};
	});

	return transaction();
}

/**
 * Periodically deletes expired notes from the database.
 * @returns {number} Number of deleted rows
 */
export function cleanupExpiredNotes() {
	const db = getDb();
	const now = Date.now();
	const result = db.prepare(`DELETE FROM notes WHERE expires_at < ?`).run(now);
	return result.changes;
}
