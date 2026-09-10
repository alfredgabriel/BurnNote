import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, resetRateLimits } from './ratelimit.js';

describe('ratelimit.js - privacy-first rate limiting', () => {
	beforeEach(() => {
		resetRateLimits();
	});

	it('allows requests within the limit', () => {
		const ip = '192.168.1.50';
		const res1 = checkRateLimit(ip, 'test_action', 3, 1000);
		expect(res1.allowed).toBe(true);
		expect(res1.remaining).toBe(2);

		const res2 = checkRateLimit(ip, 'test_action', 3, 1000);
		expect(res2.allowed).toBe(true);
		expect(res2.remaining).toBe(1);

		const res3 = checkRateLimit(ip, 'test_action', 3, 1000);
		expect(res3.allowed).toBe(true);
		expect(res3.remaining).toBe(0);
	});

	it('blocks requests once threshold is exceeded', () => {
		const ip = '10.0.0.1';
		checkRateLimit(ip, 'consume', 2, 5000);
		checkRateLimit(ip, 'consume', 2, 5000);

		// 3rd attempt exceeds limit of 2
		const blocked = checkRateLimit(ip, 'consume', 2, 5000);
		expect(blocked.allowed).toBe(false);
		expect(blocked.remaining).toBe(0);
		expect(blocked.resetAt).toBeGreaterThan(Date.now());
	});

	it('isolates different actions and clients', () => {
		const ip1 = '1.1.1.1';
		const ip2 = '2.2.2.2';

		checkRateLimit(ip1, 'action_a', 1, 5000);
		const ip1Blocked = checkRateLimit(ip1, 'action_a', 1, 5000);
		expect(ip1Blocked.allowed).toBe(false);

		// ip2 should still be allowed for action_a
		const ip2Allowed = checkRateLimit(ip2, 'action_a', 1, 5000);
		expect(ip2Allowed.allowed).toBe(true);

		// ip1 should still be allowed for a different action_b
		const ip1OtherAction = checkRateLimit(ip1, 'action_b', 1, 5000);
		expect(ip1OtherAction.allowed).toBe(true);
	});
});
