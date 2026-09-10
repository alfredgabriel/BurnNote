<script>
	import './layout.css';
	let { children } = $props();
</script>

<svelte:head>
	<title>BurnNote — Self-Destructing Encrypted Notes</title>
	<meta name="description" content="Share sensitive information through one-time, end-to-end encrypted notes that self-destruct upon reading or incorrect password." />
	<meta name="referrer" content="no-referrer" />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="min-h-screen flex flex-col bg-[#09090b] text-[#f4f4f5] bg-grid">
	<!-- Top Navigation -->
	<header class="border-b border-[#1f1f23] bg-[#09090b]/80 backdrop-blur-md sticky top-0 z-50">
		<div class="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
			<a href="/" class="flex items-center gap-2.5 group">
				<div class="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20 group-hover:scale-105 transition-transform duration-200">
					<svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
						<path stroke-linecap="round" stroke-linejoin="round" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
					</svg>
				</div>
				<span class="font-bold text-lg tracking-tight text-white group-hover:text-orange-400 transition-colors">
					Burn<span class="text-orange-500">Note</span>
				</span>
			</a>
			<div class="flex items-center gap-4 text-xs text-zinc-400">
				<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300">
					<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
					Zero-Knowledge AES-256
				</span>
			</div>
		</div>
	</header>

	<!-- Main Content Slot -->
	<main class="flex-1 max-w-4xl w-full mx-auto px-4 py-8 md:py-12 flex flex-col justify-center">
		{@render children()}
	</main>

	<!-- Minimal Privacy Footer -->
	<footer class="border-t border-[#18181b] py-6 text-center text-xs text-zinc-500">
		<div class="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
			<p>BurnNote &copy; {new Date().getFullYear()} &mdash; Self-destructing, privacy-first notes.</p>
			<div class="flex items-center gap-4 text-zinc-400">
				<span>No tracking</span>
				<span>&bull;</span>
				<span>No analytics</span>
				<span>&bull;</span>
				<span>Zero-Knowledge</span>
			</div>
		</div>
	</footer>
</div>
