import { fork, exec } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { startTunnel } from 'untun';
import localtunnel from 'localtunnel';

const PORT = parseInt(process.env.PORT || '3000', 10);

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
			exec('npm run build', (err, stdout, stderr) => {
				if (err) return reject(err);
				resolve(stdout);
			});
		});
	}

	// 2. Start the BurnNote local server
	const fs = await import('node:fs');
	fs.writeFileSync(path.resolve('.burnnote.pid'), String(process.pid));

	const serverEnv = {
		...process.env,
		PORT: String(PORT),
		NODE_ENV: 'production'
	};

	const serverProcess = fork(path.resolve('./build/index.js'), [], {
		env: serverEnv,
		stdio: 'ignore' // Clean background execution
	});

	// Wait for local server readiness
	await checkUrlReady(`http://localhost:${PORT}`);

	// 3. Establish public tunnel without prompting
	let publicUrl = '';

	try {
		// Cloudflare tunnel with automatic agreement acceptance
		const tunnel = await startTunnel({
			url: `http://localhost:${PORT}`,
			acceptCloudflareNotice: true
		});
		publicUrl = await tunnel.getURL();

		// Wait for Cloudflare global DNS propagation so user never gets NXDOMAIN
		const isReady = await checkUrlReady(publicUrl, 20, 1000);
		if (!isReady) {
			throw new Error('Cloudflare DNS propagation timeout');
		}
	} catch {
		// Fallback to localtunnel if Cloudflare is unreachable
		try {
			const lt = await localtunnel({ port: PORT });
			publicUrl = lt.url;
			await checkUrlReady(publicUrl, 10, 1000);
		} catch {
			publicUrl = `http://localhost:${PORT}`;
		}
	}

	// 4. Open browser to the verified, active public URL
	if (process.platform === 'win32') {
		exec(`start ${publicUrl}`);
	} else if (process.platform === 'darwin') {
		exec(`open ${publicUrl}`);
	} else {
		exec(`xdg-open ${publicUrl}`);
	}

	// Keep parent process alive to manage child server process
	process.on('SIGINT', () => {
		serverProcess.kill();
		process.exit(0);
	});
	process.on('SIGTERM', () => {
		serverProcess.kill();
		process.exit(0);
	});
}

main().catch(() => {
	process.exit(1);
});
