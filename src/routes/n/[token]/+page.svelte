<script>
	import { onMount } from 'svelte';
	import { computeAuthVerifier, decryptNote } from '$lib/crypto/noteCrypto.js';
	import SecurityBadge from '$lib/components/SecurityBadge.svelte';

	let { data } = $props();
	let token = $derived(data.token);

	// View states: 'checking' | 'unlock' | 'decrypted' | 'unavailable'
	let viewState = $state('checking');
	let noteSalt = $state('');
	let burnOnFailed = $state(true);

	let password = $state('');
	let showPassword = $state(false);
	let isUnlocking = $state(false);
	let unlockError = $state('');

	let decryptedContent = $state('');
	let copySuccess = $state(false);

	onMount(async () => {
		await checkStatus();
	});

	async function checkStatus() {
		viewState = 'checking';
		try {
			const res = await fetch(`/api/notes/${token}/status`);
			if (!res.ok) {
				viewState = 'unavailable';
				return;
			}
			const data = await res.json();
			if (data.exists && data.salt) {
				noteSalt = data.salt;
				burnOnFailed = data.burnOnFailedAttempt !== false;
				viewState = 'unlock';
			} else {
				viewState = 'unavailable';
			}
		} catch {
			viewState = 'unavailable';
		}
	}

	async function handleUnlock(e) {
		e.preventDefault();
		unlockError = '';

		if (!password) {
			unlockError = 'Password is required to decrypt this note.';
			return;
		}

		isUnlocking = true;

		try {
			// 1. Derive the auth verifier from password and public salt
			const authVerifier = await computeAuthVerifier(password, noteSalt);

			// 2. Submit auth verifier to server to atomically consume and destroy the note
			const res = await fetch(`/api/notes/${token}/consume`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ authVerifier })
			});

			if (!res.ok) {
				// Server burned the note or it was already unavailable
				viewState = 'unavailable';
				return;
			}

			const consumeData = await res.json();
			if (!consumeData.success || !consumeData.payload) {
				viewState = 'unavailable';
				return;
			}

			// 3. Decrypt ciphertext payload in browser using AES-256-GCM
			const plaintext = await decryptNote(consumeData.payload, password);
			decryptedContent = plaintext;
			viewState = 'decrypted';
			password = ''; // Wipe password from state
		} catch {
			// Any decryption failure or network error
			viewState = 'unavailable';
		} finally {
			isUnlocking = false;
		}
	}

	async function copyDecrypted() {
		try {
			await navigator.clipboard.writeText(decryptedContent);
			copySuccess = true;
			setTimeout(() => (copySuccess = false), 2500);
		} catch {
			// Fallback
		}
	}
</script>

<svelte:head>
	<title>BurnNote — Secure Note Access</title>
</svelte:head>

<div class="max-w-xl mx-auto w-full">
	{#if viewState === 'checking'}
		<!-- Checking Status Skeleton -->
		<div class="bg-[#121215] border border-zinc-800 rounded-2xl p-8 text-center space-y-4">
			<div class="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-zinc-800/80 animate-pulse text-zinc-500">
				<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
				</svg>
			</div>
			<h2 class="text-lg font-medium text-zinc-300">Checking note status...</h2>
		</div>

	{:else if viewState === 'unlock'}
		<!-- Unlock Screen (Step 12) -->
		<div class="space-y-6 animate-in fade-in duration-200">
			<div class="text-center space-y-2">
				<div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-950/50 border border-orange-500/30 text-orange-400 mb-1 shadow-lg shadow-orange-950/50">
					<svg class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
					</svg>
				</div>
				<h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
					This note is protected
				</h1>
				<p class="text-zinc-400 text-sm max-w-sm mx-auto">
					Enter the password provided by the sender to unlock and decrypt this secret.
				</p>
			</div>

			{#if burnOnFailed}
				<!-- Critical Destruction Warning -->
				<div class="p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs sm:text-sm space-y-1 shadow-lg shadow-red-950/20">
					<div class="font-bold flex items-center gap-2 text-red-200">
						<svg class="w-4 h-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
						</svg>
						Single Attempt &mdash; Burn on Incorrect Password
					</div>
					<p class="text-red-300/80 leading-relaxed">
						If an incorrect password is entered, this BurnNote will be <strong class="text-red-200">immediately and permanently destroyed</strong>. You will not get a second chance.
					</p>
				</div>
			{/if}

			{#if unlockError}
				<div class="p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-sm">
					{unlockError}
				</div>
			{/if}

			<form onsubmit={handleUnlock} class="bg-[#121215] border border-zinc-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
				<div class="space-y-2">
					<label for="unlock-password" class="text-xs font-semibold uppercase tracking-wider text-zinc-400">
						Password
					</label>
					<div class="relative">
						<input
							id="unlock-password"
							type={showPassword ? 'text' : 'password'}
							bind:value={password}
							placeholder="Enter note password..."
							class="w-full bg-[#18181b] border border-zinc-800 rounded-xl pl-4 pr-11 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 transition font-mono"
							required
						/>
						<button
							type="button"
							onclick={() => (showPassword = !showPassword)}
							class="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
							title={showPassword ? 'Hide password' : 'Show password'}
						>
							{#if showPassword}
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
								</svg>
							{:else}
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
								</svg>
							{/if}
						</button>
					</div>
				</div>

				<button
					type="submit"
					disabled={isUnlocking}
					class="w-full py-3.5 px-6 rounded-xl font-medium text-sm text-white bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 shadow-lg shadow-orange-500/25 focus:outline-none focus:ring-2 focus:ring-orange-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 cursor-pointer flex items-center justify-center gap-2"
				>
					{#if isUnlocking}
						<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						Verifying &amp; Decrypting...
					{:else}
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
						</svg>
						Unlock BurnNote
					{/if}
				</button>
			</form>
		</div>

	{:else if viewState === 'decrypted'}
		<!-- Decrypted Content Screen (Step 13) -->
		<div class="space-y-6 animate-in fade-in duration-300">
			<div class="text-center space-y-2">
				<div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-950/50 border border-red-500/40 text-orange-400 mb-1 shadow-lg shadow-red-950/40">
					<svg class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
						<path stroke-linecap="round" stroke-linejoin="round" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
					</svg>
				</div>
				<h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
					BurnNote Destroyed
				</h1>
				<p class="text-zinc-400 text-sm max-w-md mx-auto">
					This note has been permanently destroyed from the server database. If you reload this page, it will be gone forever.
				</p>
			</div>

			<div class="bg-[#121215] border border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<span class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
						<span class="text-xs font-semibold uppercase tracking-wider text-zinc-400">
							Decrypted Secret Content
						</span>
					</div>
					<button
						type="button"
						onclick={copyDecrypted}
						class="px-4 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-medium text-xs tracking-wider uppercase transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-orange-600/20"
					>
						{#if copySuccess}
							<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
							</svg>
							<span>Copied!</span>
						{:else}
							<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
							</svg>
							<span>Copy Content</span>
						{/if}
					</button>
				</div>

				<!-- Plain text safe rendering in pre tag (Section 25: XSS protection) -->
				<div class="bg-[#09090b] border border-zinc-800/90 rounded-xl p-4 sm:p-5 overflow-x-auto">
					<pre class="font-mono text-sm sm:text-base text-zinc-100 whitespace-pre-wrap break-words select-all leading-relaxed">{decryptedContent}</pre>
				</div>

				<div class="pt-4 border-t border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
					<div class="text-xs text-zinc-500">
						Application-level record erased from SQLite.
					</div>
					<a
						href="/"
						class="text-xs text-orange-400 hover:text-orange-300 font-medium transition-colors"
					>
						Create a new BurnNote &rarr;
					</a>
				</div>
			</div>
		</div>

	{:else}
		<!-- Generic Unavailable View (Section 28) -->
		<div class="space-y-6 text-center animate-in fade-in duration-200 py-6">
			<div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-500 mb-2">
				<svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
				</svg>
			</div>
			<div class="space-y-2">
				<h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
					This BurnNote is no longer available.
				</h1>
				<p class="text-zinc-400 text-sm max-w-md mx-auto leading-relaxed">
					This note may have already been read and self-destructed, expired, or burned due to an incorrect password attempt.
				</p>
			</div>

			<div class="pt-4">
				<a
					href="/"
					class="inline-flex items-center gap-2 py-3 px-6 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-medium text-xs tracking-wider uppercase transition shadow-lg"
				>
					<svg class="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
					</svg>
					Create a new BurnNote
				</a>
			</div>
		</div>
	{/if}
</div>
