<script>
	import { encryptNote, generateSecurePassword } from '$lib/crypto/noteCrypto.js';

	let content = $state('');
	let password = $state('');
	let showPassword = $state(false);
	let expiresInSeconds = $state(86400);
	let burnOnFailedAttempt = $state(true);
	let isSubmitting = $state(false);
	let errorMessage = $state('');

	let createdNoteUrl = $state('');
	let createdPassword = $state('');
	let copyLinkDone = $state(false);
	let copyPassDone = $state(false);

	function generatePassword() {
		password = generateSecurePassword(20);
		showPassword = true;
	}

	async function handleCreate(e) {
		e.preventDefault();
		errorMessage = '';

		if (!content.trim()) {
			errorMessage = 'ERR: Note content is empty.';
			return;
		}
		if (!password || password.length < 1) {
			errorMessage = 'ERR: Password is required.';
			return;
		}

		isSubmitting = true;
		try {
			const pkg = await encryptNote(content, password);

			const res = await fetch('/api/notes/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					tokenHash: pkg.tokenHash,
					encryptedContent: pkg.encryptedContent,
					iv: pkg.iv,
					authTag: pkg.authTag,
					salt: pkg.salt,
					authHash: pkg.authHash,
					expiresInSeconds: Number(expiresInSeconds),
					burnOnFailedAttempt
				})
			});

			let data = {};
			const text = await res.text();
			if (text) {
				try { data = JSON.parse(text); } catch { /* ignore */ }
			}

			if (!res.ok) {
				throw new Error(data.error || `Server error ${res.status}`);
			}

			createdNoteUrl = `${window.location.origin}/n/${pkg.token}`;
			createdPassword = password;
			content = '';
			password = '';
		} catch (err) {
			errorMessage = `ERR: ${err.message}`;
		} finally {
			isSubmitting = false;
		}
	}

	async function copy(text, isPass = false) {
		try {
			await navigator.clipboard.writeText(text);
			if (isPass) { copyPassDone = true; setTimeout(() => copyPassDone = false, 2000); }
			else { copyLinkDone = true; setTimeout(() => copyLinkDone = false, 2000); }
		} catch {}
	}

	function reset() {
		createdNoteUrl = '';
		createdPassword = '';
		errorMessage = '';
	}
</script>

<!-- ─── CREATED STATE ─── -->
{#if createdNoteUrl}
<div style="margin-top:2rem;">
	<div style="border:2px solid #fff;padding:2rem;margin-bottom:1rem;">
		<p style="font-size:11px;color:#888;letter-spacing:0.1em;margin:0 0 1.5rem;">// NOTE CREATED · SHARE THESE DETAILS</p>

		<label style="display:block;font-size:11px;color:#555;letter-spacing:0.08em;margin-bottom:6px;">ONE-TIME LINK</label>
		<div style="display:flex;gap:8px;margin-bottom:1.5rem;">
			<input
				readonly
				value={createdNoteUrl}
				style="flex:1;background:#0a0a0a;border:1px solid #333;color:#fff;padding:10px 12px;font-family:inherit;font-size:12px;min-width:0;outline:none;"
			/>
			<button
				type="button"
				onclick={() => copy(createdNoteUrl, false)}
				style="background:{copyLinkDone ? '#fff' : '#000'};color:{copyLinkDone ? '#000' : '#fff'};border:1px solid #fff;padding:10px 16px;cursor:pointer;font-family:inherit;font-size:11px;letter-spacing:0.08em;white-space:nowrap;transition:background 0.1s;"
			>
				{copyLinkDone ? 'COPIED' : 'COPY'}
			</button>
		</div>

		<label style="display:block;font-size:11px;color:#555;letter-spacing:0.08em;margin-bottom:6px;">PASSWORD</label>
		<div style="display:flex;gap:8px;margin-bottom:1.5rem;">
			<input
				readonly
				value={createdPassword}
				style="flex:1;background:#0a0a0a;border:1px solid #333;color:#fff;padding:10px 12px;font-family:inherit;font-size:12px;min-width:0;outline:none;"
			/>
			<button
				type="button"
				onclick={() => copy(createdPassword, true)}
				style="background:{copyPassDone ? '#fff' : '#000'};color:{copyPassDone ? '#000' : '#fff'};border:1px solid #fff;padding:10px 16px;cursor:pointer;font-family:inherit;font-size:11px;letter-spacing:0.08em;white-space:nowrap;transition:background 0.1s;"
			>
				{copyPassDone ? 'COPIED' : 'COPY'}
			</button>
		</div>

		<div style="border:1px solid #333;padding:1rem;margin-bottom:1.5rem;">
			<p style="margin:0;font-size:11px;color:#888;line-height:1.6;">
				! SAVE THE LINK AND PASSWORD NOW.<br/>
				After anyone reads it (or enters the wrong password), the note is gone forever.
			</p>
		</div>

		<button
			type="button"
			onclick={reset}
			style="background:#000;color:#555;border:1px solid #333;padding:10px 16px;cursor:pointer;font-family:inherit;font-size:11px;letter-spacing:0.08em;width:100%;"
		>
			← CREATE ANOTHER NOTE
		</button>
	</div>
</div>

<!-- ─── CREATE STATE ─── -->
{:else}
<div style="margin-top:2rem;">
	<h1 style="font-size:1.5rem;font-weight:700;letter-spacing:0.04em;margin:0 0 0.25rem;">SEND A SECRET.</h1>
	<p style="font-size:12px;color:#666;margin:0 0 2rem;letter-spacing:0.05em;">ONE LINK. ONE READ. THEN IT'S GONE.</p>

	{#if errorMessage}
	<div style="border:1px solid #ff3333;padding:12px 16px;margin-bottom:1.5rem;font-size:12px;color:#ff3333;">
		{errorMessage}
	</div>
	{/if}

	<form onsubmit={handleCreate}>

		<!-- Note Content -->
		<div style="margin-bottom:1.5rem;">
			<label for="secret-content" style="display:block;font-size:11px;color:#555;letter-spacing:0.1em;margin-bottom:6px;">
				SECRET CONTENT
			</label>
			<textarea
				id="secret-content"
				bind:value={content}
				rows="8"
				placeholder="Paste your secret here..."
				required
				style="width:100%;background:#0a0a0a;border:1px solid #333;color:#fff;padding:12px;font-family:inherit;font-size:13px;resize:vertical;outline:none;display:block;box-sizing:border-box;"
				onfocus={(e) => e.target.style.borderColor='#fff'}
				onblur={(e) => e.target.style.borderColor='#333'}
			></textarea>
		</div>

		<!-- Password -->
		<div style="margin-bottom:1.5rem;">
			<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
				<label for="note-password" style="font-size:11px;color:#555;letter-spacing:0.1em;">PASSWORD</label>
				<button
					type="button"
					onclick={generatePassword}
					style="background:none;border:none;color:#fff;cursor:pointer;font-family:inherit;font-size:11px;letter-spacing:0.08em;padding:0;text-decoration:underline;"
				>
					GENERATE
				</button>
			</div>
			<!-- Use text type always, manual show/hide to avoid browser double-icon -->
			<input
				id="note-password"
				type={showPassword ? 'text' : 'password'}
				bind:value={password}
				placeholder="Type or generate a password..."
				required
				autocomplete="new-password"
				style="width:100%;background:#0a0a0a;border:1px solid #333;color:#fff;padding:12px;font-family:inherit;font-size:13px;outline:none;display:block;box-sizing:border-box;-webkit-text-security:{showPassword ? 'none' : 'disc'};"
				onfocus={(e) => e.target.style.borderColor='#fff'}
				onblur={(e) => e.target.style.borderColor='#333'}
			/>
			<div style="margin-top:8px;">
				<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:11px;color:#555;letter-spacing:0.05em;">
					<input
						type="checkbox"
						bind:checked={showPassword}
						style="cursor:pointer;"
					/>
					SHOW PASSWORD
				</label>
			</div>
		</div>

		<!-- Expiration & Burn Grid -->
		<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.5rem;">
			<div>
				<label for="note-expiration" style="display:block;font-size:11px;color:#555;letter-spacing:0.1em;margin-bottom:6px;">
					EXPIRES IN
				</label>
				<div style="position:relative;">
					<select
						id="note-expiration"
						bind:value={expiresInSeconds}
						style="width:100%;background:#0a0a0a;border:1px solid #333;color:#fff;padding:12px;font-family:inherit;font-size:12px;outline:none;cursor:pointer;box-sizing:border-box;"
						onfocus={(e) => e.target.style.borderColor='#fff'}
						onblur={(e) => e.target.style.borderColor='#333'}
					>
						<option value={600}>10 MIN</option>
						<option value={3600}>1 HOUR</option>
						<option value={86400}>24 HOURS</option>
						<option value={604800}>7 DAYS</option>
					</select>
				</div>
			</div>
			<div style="display:flex;align-items:flex-end;">
				<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:11px;color:#555;letter-spacing:0.05em;padding-bottom:12px;">
					<input
						type="checkbox"
						bind:checked={burnOnFailedAttempt}
						style="cursor:pointer;"
					/>
					BURN ON WRONG PASSWORD
				</label>
			</div>
		</div>

		<!-- Submit -->
		<button
			type="submit"
			disabled={isSubmitting}
			style="width:100%;background:{isSubmitting ? '#111' : '#fff'};color:{isSubmitting ? '#555' : '#000'};border:2px solid {isSubmitting ? '#333' : '#fff'};padding:14px;cursor:{isSubmitting ? 'not-allowed' : 'pointer'};font-family:inherit;font-size:12px;font-weight:700;letter-spacing:0.15em;transition:all 0.15s;"
		>
			{isSubmitting ? 'ENCRYPTING...' : 'CREATE BURNNOTE →'}
		</button>

	</form>
</div>
{/if}
