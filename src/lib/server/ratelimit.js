import crypto from 'node:crypto';

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '30', 10);

// In-memory bucket cache with automatic sweep
const rateLimitCache = new Map();

// Periodic sweep every 5 minutes to prevent memory accumulation
setInterval(() => {
	const now = Date.now();
	for (const [key, record] of rateLimitCache.entries()) {
		if (now > record.resetAt) {
			rateLimitCache.delete(key);
		}
	}
}, 300000).unref();

/**
 * Checks and increments rate limit for a client and action.
 * Uses hashed client identifier for privacy.
 * 
 * @param {string} clientIp
 * @param {string} action
 * @param {number} maxRequests
 * @param {number} windowMs
 * @returns {{ allowed: boolean, remaining: number, resetAt: number }}
 */
export function checkRateLimit(
	clientIp,
	action = 'default',
	maxRequests = MAX_REQUESTS,
	windowMs = WINDOW_MS
) {
	const now = Date.now();
	// Hash IP for zero plaintext storage of client identifiers
	const ipHash = crypto.createHash('sha256').update(`${clientIp}:${action}`).digest('hex');

	let record = rateLimitCache.get(ipHash);

	if (!record || now > record.resetAt) {
		record = { count: 1, resetAt: now + windowMs };
		rateLimitCache.set(ipHash, record);
		return {
			allowed: true,
			remaining: maxRequests - 1,
			resetAt: record.resetAt
		};
	}

	if (record.count >= maxRequests) {
		return {
			allowed: false,
			remaining: 0,
			resetAt: record.resetAt
		};
	}

	record.count += 1;
	return {
		allowed: true,
		remaining: maxRequests - record.count,
		resetAt: record.resetAt
	};
}

/**
 * Clears rate limit cache (useful for testing)
 */
export function resetRateLimits() {
	rateLimitCache.clear();
}
