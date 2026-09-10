<script>
	import { encryptNote, generateSecurePassword } from '$lib/crypto/noteCrypto.js';
	import NoteCreatedCard from '$lib/components/NoteCreatedCard.svelte';
	import SecurityBadge from '$lib/components/SecurityBadge.svelte';

	let content = $state('');
	let password = $state('');
	let showPassword = $state(false);
	let expiresInSeconds = $state(86400); // 24 hours default
	let burnOnFailedAttempt = $state(true);

	let isSubmitting = $state(false);
	let errorMessage = $state('');

	// Created note state
	let createdNoteUrl = $state('');
	let createdPassword = $state('');
	let copySuccess = $state(false);
	let copyPasswordSuccess = $state(false);

	function generatePassword() {
		password = generateSecurePassword(20);
		showPassword = true;
	}

	async function handleCreate(e) {
		e.preventDefault();
		errorMessage = '';

		if (!content.trim()) {
			errorMessage = 'Please enter the sensitive note content.';
			return;
		}

		if (!password) {
			errorMessage = 'A password is required to encrypt your BurnNote.';
			return;
		}

		isSubmitting = true;

		try {
			// Client-side Zero-Knowledge encryption:
			// Plaintext and password never leave the browser!
			const encryptedPkg = await encryptNote(content, password);

			const response = await fetch('/api/notes/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					tokenHash: encryptedPkg.tokenHash,
					encryptedContent: encryptedPkg.encryptedContent,
					iv: encryptedPkg.iv,
					authTag: encryptedPkg.authTag,
					salt: encryptedPkg.salt,
					authHash: encryptedPkg.authHash,
					expiresInSeconds: Number(expiresInSeconds),
					burnOnFailedAttempt
				})
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to create note');
			}

			// Generate full one-time URL
			const baseUrl = window.location.origin;
			createdNoteUrl = `${baseUrl}/n/${encryptedPkg.token}`;
			createdPassword = password;

			// Wipe plaintext content from memory/state
			content = '';
			password = '';
		} catch (err) {
			errorMessage = err.message || 'An error occurred while creating your BurnNote.';
		} finally {
			isSubmitting = false;
		}
	}

	async function copyToClipboard(text, isPassword = false) {
		try {
			await navigator.clipboard.writeText(text);
			if (isPassword) {
				copyPasswordSuccess = true;
				setTimeout(() => (copyPasswordSuccess = false), 2500);
			} else {
				copySuccess = true;
				setTimeout(() => (copySuccess = false), 2500);
			}
		} catch {
			// Fallback if clipboard API not available
		}
	}

	function resetForm() {
		createdNoteUrl = '';
		createdPassword = '';
		content = '';
		password = '';
		errorMessage = '';
	}
</script>

{#if !createdNoteUrl}
	<!-- Note Creation Interface -->
	<div class="space-y-6">
		<div class="text-center space-y-2">
			<h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
				Share it once. <span class="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-500">Then it's gone.</span>
			</h1>
			<p class="text-zinc-400 text-sm sm:text-base max-w-lg mx-auto">
				Zero-knowledge, self-destructing notes. One link. One password. One read.
			</p>
		</div>

		{#if errorMessage}
			<div class="p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-sm flex items-center gap-3">
				<svg class="w-5 h-5 flex-shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				<span>{errorMessage}</span>
			</div>
		{/if}

		<form onsubmit={handleCreate} class="bg-[#121215] border border-zinc-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/50 space-y-6">
			<!-- Secret Content Textarea -->
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<label for="secret-content" class="text-xs font-semibold uppercase tracking-wider text-zinc-400">
						Secret Content
					</label>
					<span class="text-xs text-zinc-500">Client-side encrypted (AES-256-GCM)</span>
				</div>
				<div class="relative">
					<textarea
						id="secret-content"
						bind:value={content}
						rows="7"
						placeholder="Write your secret here (passwords, private keys, API credentials, sensitive notes)..."
						class="w-full bg-[#18181b] border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 transition duration-150 font-mono resize-y min-h-[140px]"
						required
					></textarea>
				</div>
			</div>

			<!-- Password & Expiration Grid -->
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
				<!-- Password Input -->
				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<label for="note-password" class="text-xs font-semibold uppercase tracking-wider text-zinc-400">
							Password <span class="text-orange-400">*</span>
						</label>
						<button
							type="button"
							onclick={generatePassword}
							class="text-xs text-orange-400 hover:text-orange-300 transition-colors font-medium cursor-pointer"
						>
							&plus; Generate strong
						</button>
					</div>
					<div class="relative">
						<input
							id="note-password"
							type={showPassword ? 'text' : 'password'}
							bind:value={password}
							placeholder="Recipient password..."
							class="w-full bg-[#18181b] border border-zinc-800 rounded-xl pl-4 pr-11 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 transition font-mono"
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

				<!-- Expiration Selector -->
				<div class="space-y-2">
					<label for="note-expiration" class="text-xs font-semibold uppercase tracking-wider text-zinc-400">
						Self-Destruct Lifetime
					</label>
					<div class="relative">
						<select
							id="note-expiration"
							bind:value={expiresInSeconds}
							class="w-full bg-[#18181b] border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 transition appearance-none cursor-pointer"
						>
							<option value={600}>10 minutes</option>
							<option value={3600}>1 hour</option>
							<option value={86400}>24 hours (Recommended)</option>
							<option value={604800}>7 days</option>
						</select>
						<div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-zinc-500">
							<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
							</svg>
						</div>
					</div>
				</div>
			</div>

			<!-- Advanced Security Options -->
			<div class="pt-2 border-t border-zinc-800/60 flex items-center justify-between">
				<div class="flex items-center gap-3">
					<input
						type="checkbox"
						id="burn-failed"
						bind:checked={burnOnFailedAttempt}
						class="w-4 h-4 rounded bg-zinc-800 border-zinc-700 text-orange-500 focus:ring-orange-500/40 focus:ring-offset-0 cursor-pointer"
					/>
					<label for="burn-failed" class="text-xs sm:text-sm text-zinc-300 select-none cursor-pointer">
						Destroy note immediately if an incorrect password is typed
					</label>
				</div>
				<span class="text-xs text-orange-400/90 font-medium hidden sm:inline">Burn-on-fail</span>
			</div>

			<!-- Submit Button -->
			<button
				type="submit"
				disabled={isSubmitting}
				class="w-full py-3.5 px-6 rounded-xl font-medium text-sm text-white bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 shadow-lg shadow-orange-500/25 focus:outline-none focus:ring-2 focus:ring-orange-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 cursor-pointer flex items-center justify-center gap-2"
			>
				{#if isSubmitting}
					<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
					</svg>
					Deriving Keys &amp; Encrypting...
				{:else}
					<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
					</svg>
					Create BurnNote
				{/if}
			</button>
		</form>
	</div>
{:else}
	<NoteCreatedCard
		noteUrl={createdNoteUrl}
		password={createdPassword}
		onReset={resetForm}
	/>
{/if}

