<script>
	let { noteUrl, password, onReset } = $props();

	let copyLinkSuccess = $state(false);
	let copyPassSuccess = $state(false);

	async function copy(text, isPass = false) {
		try {
			await navigator.clipboard.writeText(text);
			if (isPass) {
				copyPassSuccess = true;
				setTimeout(() => (copyPassSuccess = false), 2500);
			} else {
				copyLinkSuccess = true;
				setTimeout(() => (copyLinkSuccess = false), 2500);
			}
		} catch {
			// Fallback
		}
	}
</script>

<div class="space-y-6 animate-in fade-in duration-300">
	<div class="text-center space-y-2">
		<div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 mb-1 shadow-lg shadow-emerald-950/40">
			<svg class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
			</svg>
		</div>
		<h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
			Your BurnNote is ready
		</h1>
		<p class="text-zinc-400 text-sm max-w-md mx-auto">
			Send this one-time link and password to your recipient. Once opened or if an incorrect password is entered, it will be permanently destroyed.
		</p>
	</div>

	<div class="bg-[#121215] border border-zinc-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/50 space-y-6">
		<!-- Secret Link Box -->
		<div class="space-y-2">
			<div class="flex items-center justify-between">
				<label for="created-card-link-input" class="text-xs font-semibold uppercase tracking-wider text-zinc-400">
					One-Time Secret Link
				</label>
				<span class="text-xs text-zinc-500">Unpredictable 256-bit Token</span>
			</div>
			<div class="flex gap-2">
				<input
					id="created-card-link-input"
					type="text"
					readonly
					value={noteUrl}
					class="w-full bg-[#18181b] border border-zinc-800 rounded-xl px-4 py-2.5 text-sm font-mono text-zinc-200 select-all focus:outline-none focus:border-orange-500/60 transition"
				/>
				<button
					type="button"
					onclick={() => copy(noteUrl, false)}
					class="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-medium text-xs tracking-wide uppercase transition duration-150 flex-shrink-0 cursor-pointer shadow-lg shadow-orange-600/25 flex items-center gap-1.5"
				>
					{#if copyLinkSuccess}
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
						</svg>
						<span>Copied!</span>
					{:else}
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
						</svg>
						<span>Copy Link</span>
					{/if}
				</button>
			</div>
		</div>

		<!-- Password Box -->
		<div class="space-y-2">
			<label for="created-card-password-input" class="text-xs font-semibold uppercase tracking-wider text-zinc-400">
				Note Password
			</label>
			<div class="flex gap-2">
				<input
					id="created-card-password-input"
					type="text"
					readonly
					value={password}
					class="w-full bg-[#18181b] border border-zinc-800 rounded-xl px-4 py-2.5 text-sm font-mono text-amber-300 font-bold select-all focus:outline-none focus:border-amber-500/60 transition"
				/>
				<button
					type="button"
					onclick={() => copy(password, true)}
					class="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs tracking-wide uppercase transition duration-150 flex-shrink-0 cursor-pointer flex items-center gap-1.5"
				>
					{#if copyPassSuccess}
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
						</svg>
						<span>Copied!</span>
					{:else}
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
						</svg>
						<span>Copy</span>
					{/if}
				</button>
			</div>
		</div>

		<!-- Warning Notification -->
		<div class="p-4 rounded-xl bg-amber-950/30 border border-amber-800/40 text-amber-300 text-xs sm:text-sm space-y-1.5">
			<div class="font-semibold flex items-center gap-2 text-amber-200">
				<svg class="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
				</svg>
				Save the link and password now
			</div>
			<p class="text-amber-300/80 leading-relaxed">
				The server never stores your password or plaintext notes. Once you leave this page, the credentials cannot be recovered or shown again.
			</p>
		</div>

		<button
			type="button"
			onclick={onReset}
			class="w-full py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-medium text-xs tracking-wider uppercase transition cursor-pointer flex items-center justify-center gap-2"
		>
			<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z" />
			</svg>
			Create Another BurnNote
		</button>
	</div>
</div>
