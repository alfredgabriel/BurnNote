import { fork, exec } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { startTunnel } from 'untun';
import localtunnel from 'localtunnel';

const PORT = parseInt(process.env.PORT || '3000', 10);

async function main() {
	console.log('\n🔥 Iniciando BurnNote con túnel seguro...\n');

	// 1. Check if production build exists; if not, build it
	if (!existsSync(path.resolve('./build/index.js'))) {
		console.log('📦 Primera ejecución: Compilando la aplicación (solo tardará unos segundos)...');
		await new Promise((resolve, reject) => {
			const buildProcess = exec('npm run build', (err, stdout, stderr) => {
				if (err) {
					console.error(stderr);
					return reject(err);
				}
				resolve(stdout);
			});
		});
		console.log('✅ Compilación completada con éxito.');
	}

	// 2. Start the BurnNote server
	console.log(`🚀 Arrancando servidor local en el puerto ${PORT}...`);
	const serverEnv = {
		...process.env,
		PORT: String(PORT),
		NODE_ENV: 'production'
	};

	const serverProcess = fork(path.resolve('./build/index.js'), [], {
		env: serverEnv,
		stdio: 'inherit'
	});

	// Wait 1.5s for the server to be listening
	await new Promise((r) => setTimeout(r, 1500));

	// 3. Establish public tunnel
	console.log('🌐 Creando túnel público seguro con HTTPS...');
	let publicUrl = '';

	try {
		// Attempt 1: Cloudflare Tunnel via untun (fastest, no interstitial screen)
		const tunnel = await startTunnel({ url: `http://localhost:${PORT}` });
		publicUrl = await tunnel.getURL();
	} catch (err) {
		console.warn('⚠️ Cloudflare tunnel falló, intentando túnel alternativo...');
		try {
			// Attempt 2: localtunnel fallback
			const lt = await localtunnel({ port: PORT });
			publicUrl = lt.url;
		} catch (ltErr) {
			console.error('❌ No se pudo crear el túnel automáticamente:', ltErr.message);
			publicUrl = `http://localhost:${PORT}`;
		}
	}

	// 4. Display banner
	console.log('\n=============================================================');
	console.log('   🔥 BURNNOTE ESTÁ FUNCIONANDO Y LISTO PARA COMPARTIR');
	console.log('=============================================================');
	console.log(`\n👉 ENLACE PÚBLICO (Cualquiera en el mundo puede abrirlo):`);
	console.log(`   \x1b[32m\x1b[1m${publicUrl}\x1b[0m\n`);
	console.log(`🏠 Enlace local (solo para ti):`);
	console.log(`   http://localhost:${PORT}\n`);
	console.log('=============================================================');
	console.log('💡 Cuando crees una nota aquí, el enlace que generes');
	console.log('   lo podrá abrir cualquier amigo desde su casa o móvil.');
	console.log('=============================================================\n');

	// 5. Open in default browser on Windows
	if (process.platform === 'win32') {
		exec(`start ${publicUrl}`);
	}

	// Handle exit signals
	process.on('SIGINT', () => {
		serverProcess.kill('SIGINT');
		process.exit(0);
	});
	process.on('SIGTERM', () => {
		serverProcess.kill('SIGTERM');
		process.exit(0);
	});
}

main().catch((err) => {
	console.error('Error al iniciar BurnNote con túnel:', err);
	process.exit(1);
});
