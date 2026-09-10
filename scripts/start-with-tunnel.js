import { fork, exec } from 'node:child_process';
import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { startTunnel } from 'untun';
import localtunnel from 'localtunnel';

const PORT = parseInt(process.env.PORT || '3000', 10);
const ROOT = path.resolve('.');
const SENTINEL = path.join(ROOT, '.burnnote-ready');

async function checkUrlReady(url, maxRetries = 25, delayMs = 1000) {
	for (let i = 0; i < maxRetries; i++) {
		try {
			const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
			if (res.status === 200 || res.status === 304 || res.status === 404) {
				return true;
			}
		} catch {
			// DNS propagating or server still booting
		}
		await new Promise((r) => setTimeout(r, delayMs));
	}
	return false;
}

async function main() {
	// 1. Check if production build exists; if not, build it
	if (!existsSync(path.resolve('./build/index.js'))) {
		await new Promise((resolve, reject) => {
			exec('npm run build', (err) => {
				if (err) return reject(err);
				resolve();
			});
		});
	}

	// 2. Write our PID for clean stop
	writeFileSync(path.join(ROOT, '.burnnote.pid'), String(process.pid));

	// 3. Start the BurnNote local server
	const serverProcess = fork(path.resolve('./build/index.js'), [], {
		env: {
			...process.env,
			PORT: String(PORT),
			NODE_ENV: 'production'
		},
		stdio: 'ignore'
	});

	// Wait for local server readiness
	await checkUrlReady(`http://localhost:${PORT}`);

	// 4. Establish public tunnel without prompting
	let publicUrl = '';

	try {
		// Cloudflare tunnel
		const tunnel = await startTunnel({
			url: `http://localhost:${PORT}`,
			acceptCloudflareNotice: true
		});
		publicUrl = await tunnel.getURL();

		// Wait for DNS propagation
		const isReady = await checkUrlReady(publicUrl, 20, 1000);
		if (!isReady) {
			throw new Error('Cloudflare DNS propagation timeout');
		}
	} catch {
		// Fallback to localtunnel
		try {
			const lt = await localtunnel({ port: PORT });
			publicUrl = lt.url;
			await checkUrlReady(publicUrl, 10, 1000);
		} catch {
			publicUrl = `http://localhost:${PORT}`;
		}
	}

	// 5. Signal the splash screen to close
	writeFileSync(SENTINEL, 'ready');

	// 6. Small delay to let HTA catch the sentinel, then open browser
	await new Promise((r) => setTimeout(r, 600));

	// Clean up sentinel if HTA hasn't already
	try { unlinkSync(SENTINEL); } catch {}

	// Open browser
	if (process.platform === 'win32') {
		exec(`start ${publicUrl}`);
	} else if (process.platform === 'darwin') {
		exec(`open ${publicUrl}`);
	} else {
		exec(`xdg-open ${publicUrl}`);
	}

	// Keep alive for signal handling
	process.on('SIGINT', () => { serverProcess.kill(); process.exit(0); });
	process.on('SIGTERM', () => { serverProcess.kill(); process.exit(0); });
}

main().catch(() => {
	process.exit(1);
});
