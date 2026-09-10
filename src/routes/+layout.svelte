<script>
	import './layout.css';
	let { children } = $props();
</script>

<svelte:head>
	<title>BurnNote</title>
	<meta name="description" content="Notas cifradas de un solo uso. Se destruyen al leer." />
	<meta name="referrer" content="no-referrer" />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="min-h-screen flex flex-col" style="background:#000;color:#fff;font-family:'Courier New',monospace;">

	<!-- Header -->
	<header style="border-bottom:1px solid #222;padding:0 1.5rem;">
		<div style="max-width:640px;margin:0 auto;height:56px;display:flex;align-items:center;justify-content:space-between;">
			<a href="/" style="text-decoration:none;color:#fff;font-size:1.1rem;font-weight:700;letter-spacing:0.05em;">
				BURN<span style="color:#fff;text-decoration:line-through;">NOTE</span>
			</a>
			<span style="font-size:11px;color:#555;letter-spacing:0.1em;text-transform:uppercase;">AES-256-GCM · ZERO-KNOWLEDGE</span>
		</div>
	</header>

	<!-- Content -->
	<main style="flex:1;max-width:640px;width:100%;margin:0 auto;padding:2rem 1.5rem;">
		{@render children()}
	</main>

	<!-- Footer -->
	<footer style="border-top:1px solid #222;padding:1rem 1.5rem;text-align:center;">
		<span style="font-size:11px;color:#444;letter-spacing:0.08em;">NO TRACKING · NO LOGS · SELF-HOSTED</span>
	</footer>
</div>
