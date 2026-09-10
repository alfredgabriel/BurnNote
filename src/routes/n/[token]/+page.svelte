<script>
	import { onMount } from 'svelte';
	import { computeAuthVerifier, decryptNote } from '$lib/crypto/noteCrypto.js';

	let { data } = $props();
	let token = $derived(data.token);

	let viewState = $state('checking');
	let noteSalt = $state('');
	let burnOnFailed = $state(true);

	let password = $state('');
	let showPassword = $state(false);
	let isUnlocking = $state(false);

	let decryptedContent = $state('');
	let copyDone = $state(false);

	onMount(async () => {
		try {
			const res = await fetch(`/api/notes/${token}/status`);
			if (!res.ok) { viewState = 'unavailable'; return; }
			const d = await res.json();
			if (d.exists && d.salt) {
				noteSalt = d.salt;
				burnOnFailed = d.burnOnFailedAttempt !== false;
				viewState = 'unlock';
			} else {
				viewState = 'unavailable';
			}
		} catch {
			viewState = 'unavailable';
		}
	});

	async function handleUnlock(e) {
		e.preventDefault();
		isUnlocking = true;
		try {
			const authVerifier = await computeAuthVerifier(password, noteSalt);
			const res = await fetch(`/api/notes/${token}/consume`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ authVerifier })
			});
			if (!res.ok) { viewState = 'unavailable'; return; }
			const d = await res.json();
			if (!d.success || !d.payload) { viewState = 'unavailable'; return; }
			decryptedContent = await decryptNote(d.payload, password);
			password = '';
			viewState = 'decrypted';
		} catch {
			viewState = 'unavailable';
		} finally {
			isUnlocking = false;
		}
	}

	async function copyContent() {
		try {
			await navigator.clipboard.writeText(decryptedContent);
			copyDone = true;
			setTimeout(() => copyDone = false, 2000);
		} catch {}
	}
</script>

<svelte:head>
	<title>BurnNote — Open Note</title>
</svelte:head>

<div style="margin-top:2rem;">

{#if viewState === 'checking'}
	<p style="font-size:12px;color:#555;letter-spacing:0.1em;">// CHECKING...</p>

{:else if viewState === 'unlock'}
	<h1 style="font-size:1.2rem;font-weight:700;letter-spacing:0.04em;margin:0 0 0.25rem;">PROTECTED NOTE</h1>
	<p style="font-size:12px;color:#666;margin:0 0 2rem;letter-spacing:0.05em;">ENTER THE PASSWORD TO DECRYPT AND DESTROY THIS NOTE.</p>

	{#if burnOnFailed}
	<div style="border:1px solid #ff3333;padding:12px 16px;margin-bottom:1.5rem;font-size:11px;color:#ff3333;letter-spacing:0.05em;">
		! WARNING: One attempt only. Wrong password = note destroyed permanently.
	</div>
	{/if}

	<form onsubmit={handleUnlock}>
		<div style="margin-bottom:1.5rem;">
			<label for="unlock-password" style="display:block;font-size:11px;color:#555;letter-spacing:0.1em;margin-bottom:6px;">PASSWORD</label>
			<input
				id="unlock-password"
				type={showPassword ? 'text' : 'password'}
				bind:value={password}
				placeholder="Enter password..."
				required
				autocomplete="current-password"
				style="width:100%;background:#0a0a0a;border:1px solid #333;color:#fff;padding:12px;font-family:inherit;font-size:13px;outline:none;display:block;box-sizing:border-box;"
				onfocus={(e) => e.target.style.borderColor='#fff'}
				onblur={(e) => e.target.style.borderColor='#333'}
			/>
			<div style="margin-top:8px;">
				<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:11px;color:#555;letter-spacing:0.05em;">
					<input type="checkbox" bind:checked={showPassword} style="cursor:pointer;" />
					SHOW PASSWORD
				</label>
			</div>
		</div>

		<button
			type="submit"
			disabled={isUnlocking}
			style="width:100%;background:{isUnlocking ? '#111' : '#fff'};color:{isUnlocking ? '#555' : '#000'};border:2px solid {isUnlocking ? '#333' : '#fff'};padding:14px;cursor:{isUnlocking ? 'not-allowed' : 'pointer'};font-family:inherit;font-size:12px;font-weight:700;letter-spacing:0.15em;transition:all 0.15s;"
		>
			{isUnlocking ? 'DECRYPTING...' : 'UNLOCK & DESTROY →'}
		</button>
	</form>

{:else if viewState === 'decrypted'}
	<h1 style="font-size:1.2rem;font-weight:700;letter-spacing:0.04em;margin:0 0 0.25rem;">NOTE OPENED.</h1>
	<p style="font-size:12px;color:#666;margin:0 0 1.5rem;letter-spacing:0.05em;">THE NOTE HAS BEEN PERMANENTLY DELETED FROM THE SERVER.</p>

	<div style="border:1px solid #333;padding:1.5rem;margin-bottom:1rem;position:relative;">
		<pre style="margin:0;font-family:inherit;font-size:13px;color:#fff;white-space:pre-wrap;word-break:break-word;line-height:1.6;">{decryptedContent}</pre>
	</div>

	<div style="display:flex;gap:8px;margin-bottom:1.5rem;">
		<button
			type="button"
			onclick={copyContent}
			style="background:{copyDone ? '#fff' : '#000'};color:{copyDone ? '#000' : '#fff'};border:1px solid #fff;padding:10px 20px;cursor:pointer;font-family:inherit;font-size:11px;letter-spacing:0.1em;transition:all 0.1s;"
		>
			{copyDone ? 'COPIED' : 'COPY CONTENT'}
		</button>
	</div>

	<div style="border:1px solid #333;padding:12px 16px;font-size:11px;color:#555;letter-spacing:0.05em;">
		Reload this page and the note will be gone. This is the only time you can see it.
	</div>


{:else}
	<h1 style="font-size:1.2rem;font-weight:700;letter-spacing:0.04em;margin:0 0 0.5rem;">NOTE NOT FOUND.</h1>
	<p style="font-size:12px;color:#666;margin:0 0 2rem;letter-spacing:0.05em;line-height:1.7;">
		This note may have been read, expired, or destroyed by an incorrect password attempt.
	</p>
{/if}

</div>
