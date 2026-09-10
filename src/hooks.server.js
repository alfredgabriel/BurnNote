/**
 * BurnNote Server Hooks
 * 
 * Enforces strict privacy and security policies:
 * - Content-Security-Policy (CSP)
 * - Strict Referrer-Policy (no-referrer to prevent token leakage)
 * - Anti-clickjacking (X-Frame-Options: DENY, frame-ancestors 'none')
 * - No-cache headers for sensitive note routes
 * - Conditional HSTS for HTTPS connections
 */

import { startExpiredNotesCleaner } from '$lib/server/cleanup.js';

// Start the background expired notes sweeper on server startup
startExpiredNotesCleaner();

export async function handle({ event, resolve }) {
	const response = await resolve(event);

	// Security Headers
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'no-referrer');
	response.headers.set(
		'Permissions-Policy',
		'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
	);

	// Content Security Policy
	// In development, Vite requires 'unsafe-inline', 'unsafe-eval', and 'ws:' for HMR and script execution
	const csp = [
		"default-src 'self'",
		"script-src 'self' 'unsafe-inline' 'unsafe-eval'",
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data:",
		"font-src 'self'",
		"connect-src 'self' ws: http: https:",
		"frame-ancestors 'none'",
		"base-uri 'self'",
		"form-action 'self'"
	].join('; ');
	response.headers.set('Content-Security-Policy', csp);

	// Strict Transport Security (HSTS) when on HTTPS or behind a TLS reverse proxy
	const isHttps =
		event.url.protocol === 'https:' ||
		event.request.headers.get('x-forwarded-proto') === 'https';
	if (isHttps) {
		response.headers.set(
			'Strict-Transport-Security',
			'max-age=63072000; includeSubDomains; preload'
		);
	}

	// Disable caching for note routes and API endpoints to prevent disk/proxy caching of secrets
	const isSensitiveRoute =
		event.url.pathname.startsWith('/n/') ||
		event.url.pathname.startsWith('/api/');

	if (isSensitiveRoute) {
		response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
		response.headers.set('Pragma', 'no-cache');
		response.headers.set('Expires', '0');
	}

	return response;
}
