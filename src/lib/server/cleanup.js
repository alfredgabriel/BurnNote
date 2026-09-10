import { cleanupExpiredNotes } from './db.js';

const CLEANUP_INTERVAL_MS = parseInt(process.env.CLEANUP_INTERVAL_MS || '300000', 10); // 5 minutes

let isCleanerRunning = false;

/**
 * Starts the background expired notes sweeper.
 * Uses unref() so it does not prevent Node.js from exiting cleanly.
 */
export function startExpiredNotesCleaner() {
	if (isCleanerRunning) {
		return;
	}
	isCleanerRunning = true;

	// Initial sweep on server startup
	try {
		cleanupExpiredNotes();
	} catch {
		// Ignore startup sweep errors before db ready
	}

	const interval = setInterval(() => {
		try {
			cleanupExpiredNotes();
		} catch {
			// Silent error to prevent leaking internal database issues
		}
	}, CLEANUP_INTERVAL_MS);

	if (interval.unref) {
		interval.unref();
	}
}
