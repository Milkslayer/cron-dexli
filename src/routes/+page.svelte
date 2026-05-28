<script lang="ts">
	// Single-page cron parser/preview. Three regions:
	//   - Topbar: Wordmark + tz switcher + share-link copy
	//   - Hero: expression input + live interpretation + field-specific error
	//   - Body: 5 next firings + click-to-populate pattern library
	//
	// The 30-second-product rule (bar item 8) is the design oracle for the
	// hero — typing or clicking a pattern must produce a visible
	// interpretation + firings list in one frame. Everything reactive runs
	// off `interpret(expression, tz, now)` returning a discriminated union;
	// the UI just branches on .ok.
	import { onMount } from 'svelte';
	import { env } from '$env/dynamic/public';
	import Wordmark from '$lib/components/Wordmark.svelte';
	import { interpret, type CronResult } from '$lib/cron';
	import {
		readUrlState,
		writeUrlState,
		flushUrlState,
		shareUrl,
		type UrlState
	} from '$lib/url-state';
	import { PATTERNS } from '$lib/patterns';

	// Operator-canonical origin from backend's config.ts via SvelteKit's
	// PUBLIC_*-prefixed dynamic public env. Honors PUBLIC_BASE_URL when set;
	// falls back to window.location inside shareUrl() when null/undefined.
	// Mirrors tinywebhook cycle-4a's family discipline.
	const PUBLIC_BASE_URL: string | undefined = env.PUBLIC_BASE_URL;

	// Common IANA zones — covers the working hours of ~95% of devs. Order
	// is roughly user-prevalence top-down. "Local" appears as the first
	// option, resolved at mount from the browser.
	const TIMEZONES = [
		'UTC',
		'America/New_York',
		'America/Chicago',
		'America/Denver',
		'America/Los_Angeles',
		'Europe/London',
		'Europe/Paris',
		'Europe/Berlin',
		'Europe/Oslo',
		'Asia/Dubai',
		'Asia/Kolkata',
		'Asia/Shanghai',
		'Asia/Tokyo',
		'Australia/Sydney',
		'Pacific/Auckland'
	];

	// Default chosen so the very first render shows something legible — a
	// pattern most users immediately recognize. Bar item 8's 30-second
	// flow lands here for users who didn't bring a ?e= URL.
	const DEFAULT_EXPR = '*/5 * * * *';

	let expression = $state(DEFAULT_EXPR);
	let localTz = $state('UTC'); // resolved at mount from Intl
	let tz = $state('UTC'); // current selection
	// Remembered last NON-UTC tz, so the dedicated UTC toggle flips back
	// to wherever the user was instead of dropping them at localTz (which
	// they may have explicitly moved away from). Cycle-1a oracle fix:
	// bar item 3's "quick UTC toggle" is a single-input state-flip control
	// outside the picker, not satisfied by the picker's own UTC entry.
	let previousTz = $state('UTC');
	let now = $state(new Date());
	let exprCopied = $state(false);
	let linkCopied = $state(false);
	// Guard against the $effect running BEFORE onMount has had a chance to
	// read the URL — without this, the very first effect fires with the
	// DEFAULT_EXPR and would queue a debounced replaceState that overwrites
	// what the user navigated with.
	let initialized = $state(false);
	let nowTimer: ReturnType<typeof setInterval> | undefined;
	let exprCopyTimer: ReturnType<typeof setTimeout> | undefined;
	let linkCopyTimer: ReturnType<typeof setTimeout> | undefined;

	let result = $derived<CronResult>(interpret(expression, tz, now));

	// URL sync — fires on every reactive read of expression + tz, but
	// writeUrlState's internal debounce coalesces rapid keystrokes into a
	// single replaceState per 200ms.
	$effect(() => {
		const state: UrlState = { expression, tz };
		if (!initialized) return;
		writeUrlState(state);
	});

	// Track the last non-UTC tz the user selected (via picker OR URL hydrate)
	// so toggleUtc() can flip back there cleanly. Update only on non-UTC
	// transitions; UTC itself is the OTHER side of the toggle.
	$effect(() => {
		if (initialized && tz !== 'UTC') previousTz = tz;
	});

	function toggleUtc() {
		if (tz === 'UTC') {
			// Flip back to wherever the user was before, falling back to
			// browser-local if they've never been off UTC this session.
			tz = previousTz !== 'UTC' ? previousTz : localTz;
		} else {
			previousTz = tz;
			tz = 'UTC';
		}
	}

	onMount(() => {
		try {
			localTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
		} catch {
			/* keep UTC fallback */
		}

		const fromUrl = readUrlState();
		if (fromUrl.expression !== undefined) expression = fromUrl.expression;
		tz = fromUrl.tz ?? localTz;
		// Seed previousTz: if the user landed on UTC (default or hydrated),
		// the toggle's "previous" should fall back to local. Otherwise
		// remember whatever they hydrated with as the toggle-back target.
		previousTz = tz !== 'UTC' ? tz : localTz;

		initialized = true;

		// 15s ticker so "in X minutes" relative timestamps stay fresh
		// without burning CPU on per-second renders.
		nowTimer = setInterval(() => {
			now = new Date();
		}, 15_000);
		return () => {
			clearInterval(nowTimer);
			clearTimeout(exprCopyTimer);
			clearTimeout(linkCopyTimer);
		};
	});

	async function copyExpression() {
		try {
			await navigator.clipboard.writeText(expression);
			exprCopied = true;
			clearTimeout(exprCopyTimer);
			exprCopyTimer = setTimeout(() => (exprCopied = false), 1400);
		} catch {
			/* clipboard write blocked — silent; the value is still right there in the input */
		}
	}

	async function copyShareLink() {
		// Force-flush the pending URL write so what we copy matches what's
		// actually in the address bar at this instant.
		flushUrlState({ expression, tz });
		try {
			await navigator.clipboard.writeText(shareUrl({ expression, tz }, PUBLIC_BASE_URL));
			linkCopied = true;
			clearTimeout(linkCopyTimer);
			linkCopyTimer = setTimeout(() => (linkCopied = false), 1400);
		} catch {
			/* silent */
		}
	}

	function selectPattern(expr: string) {
		expression = expr;
	}
</script>

<script lang="ts" module>
	const SEO = {
		title: 'cron.dexli.dev — cron expression parser and firings preview',
		description:
			'Paste a cron expression to see the next firing times across timezones, browse the pattern library, and share the parsed state as a single URL. No server round-trips.',
		url: 'https://cron.dexli.dev/',
		ogImage: 'https://cron.dexli.dev/og-card.png'
	};
	const JSON_LD = {
		'@context': 'https://schema.org',
		'@type': 'WebApplication',
		name: 'cron.dexli.dev',
		url: SEO.url,
		description:
			'Live cron expression parser with timezone-aware firings preview, pattern library, and URL-shareable state.',
		applicationCategory: 'DeveloperApplication',
		operatingSystem: 'Any',
		offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
	};
</script>

<svelte:head>
	<title>{SEO.title}</title>
	<meta name="description" content={SEO.description} />

	<!-- Open Graph (X / HN / Discord / Slack unfurling) -->
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="dexli.dev" />
	<meta property="og:url" content={SEO.url} />
	<meta property="og:title" content={SEO.title} />
	<meta property="og:description" content={SEO.description} />
	<meta property="og:image" content={SEO.ogImage} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />

	<!-- Twitter / X — mirrors OG, summary_large_image card -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={SEO.title} />
	<meta name="twitter:description" content={SEO.description} />
	<meta name="twitter:image" content={SEO.ogImage} />

	<!-- Schema.org structured data -->
	{@html `<script type="application/ld+json">${JSON.stringify(JSON_LD)}</script>`}
</svelte:head>

<div class="page">
	<header class="topbar wrap">
		<Wordmark />
		<div class="head-right">
			<label class="tz-wrap">
				<span class="tz-label">Zone</span>
				<select class="tz" bind:value={tz} aria-label="Timezone">
					<option value={localTz}>Local — {localTz}</option>
					{#each TIMEZONES as z}
						<option value={z}>{z}</option>
					{/each}
				</select>
			</label>
			<!-- Cycle-1a: dedicated UTC toggle outside the picker. Single-
			     input state-flip — click while in UTC restores the previous
			     tz; click while not in UTC stashes current and flips to UTC. -->
			<button
				class="btn-utc"
				class:active={tz === 'UTC'}
				onclick={toggleUtc}
				type="button"
				aria-pressed={tz === 'UTC'}
				title={tz === 'UTC'
					? `Currently UTC — click to restore ${previousTz}`
					: 'Quick toggle to UTC'}
			>
				UTC
			</button>
			<button
				class="btn-ghost"
				onclick={copyShareLink}
				title="Copy shareable URL with current expression + timezone"
				aria-label="Copy shareable link"
				type="button"
			>
				{#if linkCopied}
					<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
						<path
							d="M5 13l4 4L19 7"
							fill="none"
							stroke="currentColor"
							stroke-width="2.2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
					Copied
				{:else}
					<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
						<path
							d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L11.5 7M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5"
							fill="none"
							stroke="currentColor"
							stroke-width="1.8"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
					Share link
				{/if}
			</button>
		</div>
	</header>

	<main class="hero wrap">
		<p class="eyebrow">CRON EXPRESSION PARSER</p>
		<h1>Read a cron expression <span class="accent">at a glance.</span></h1>
		<p class="sub">
			Paste or type a 5-field cron expression. See what it means in plain English and the next
			five times it fires — in any timezone, with one click to copy a shareable link.
		</p>

		<div class="editor" class:err={!result.ok}>
			<input
				class="expr"
				type="text"
				spellcheck="false"
				autocomplete="off"
				autocapitalize="off"
				autocorrect="off"
				bind:value={expression}
				placeholder="*/5 * * * *"
				aria-label="Cron expression"
				aria-invalid={!result.ok}
			/>
			<button
				class="btn-copy"
				onclick={copyExpression}
				title="Copy expression to clipboard"
				aria-label="Copy expression"
				type="button"
			>
				{#if exprCopied}
					<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
						<path
							d="M5 13l4 4L19 7"
							fill="none"
							stroke="currentColor"
							stroke-width="2.2"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
					<span>Copied</span>
				{:else}
					<svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
						<rect
							x="9"
							y="9"
							width="11"
							height="11"
							rx="2"
							fill="none"
							stroke="currentColor"
							stroke-width="1.8"
						/>
						<path
							d="M5 15V5a2 2 0 0 1 2-2h10"
							fill="none"
							stroke="currentColor"
							stroke-width="1.8"
							stroke-linecap="round"
						/>
					</svg>
					<span>Copy</span>
				{/if}
			</button>
		</div>

		{#if result.ok}
			<p class="human" role="status">
				<span class="dot" aria-hidden="true">●</span>
				{result.human}
			</p>
		{:else}
			<div class="err-card" role="alert" data-field={result.field ?? 'shape'}>
				<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" class="err-ico">
					<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7" />
					<path
						d="M12 7v6m0 3.2v.2"
						stroke="currentColor"
						stroke-width="1.8"
						stroke-linecap="round"
					/>
				</svg>
				<div class="err-body">
					<span class="err-msg">{result.message}</span>
					{#if result.hint}
						<span class="err-hint">{result.hint}</span>
					{/if}
				</div>
			</div>
		{/if}

		<section class="grid">
			<div class="firings">
				<header class="bhead">
					<h2>Next 5 firings</h2>
					<span class="zone-tag" title={tz}>{tz}</span>
				</header>
				{#if result.ok}
					<ol class="fire-list">
						{#each result.firings as f, i (f.iso)}
							<li class="fire-row">
								<span class="fire-idx">{i + 1}</span>
								<span class="fire-rel">{f.relative}</span>
								<span class="fire-abs">{f.absolute}</span>
							</li>
						{/each}
					</ol>
				{:else}
					<p class="muted">No firings — fix the expression first.</p>
				{/if}
			</div>

			<div class="patterns">
				<header class="bhead">
					<h2>Common patterns</h2>
					<span class="hint">Click to use</span>
				</header>
				<ul class="chip-list">
					{#each PATTERNS as p}
						<li>
							<button
								class="chip"
								class:active={p.expr === expression}
								title={p.hint}
								onclick={() => selectPattern(p.expr)}
								type="button"
							>
								<span class="chip-label">{p.label}</span>
								<code class="chip-expr">{p.expr}</code>
							</button>
						</li>
					{/each}
				</ul>
			</div>
		</section>
	</main>

	<footer class="foot wrap">
		<span>A tiny tool for reading scheduled jobs.</span>
		<span class="family">
			Part of the
			<a href="https://dexli.dev">dexli.dev</a>
			tiny-tools family —
			<a href="https://webhook.dexli.dev" rel="external">webhook.dexli.dev</a>
			·
			<a href="https://regex.dexli.dev" rel="external">regex.dexli.dev</a>
		</span>
		<span class="dim">2026 · cron · dexli.dev</span>
	</footer>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		background:
			radial-gradient(800px 420px at 78% -10%, var(--accent-glow), transparent 60%),
			radial-gradient(900px 500px at 8% 110%, rgba(198, 241, 53, 0.05), transparent 60%);
	}
	.wrap {
		width: 100%;
		max-width: var(--maxw);
		margin: 0 auto;
		padding: 0 24px;
	}

	.topbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-top: 22px;
		padding-bottom: 22px;
	}
	.head-right {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.tz-wrap {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		color: var(--muted);
	}
	.tz-label {
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-size: 10.5px;
	}
	.tz {
		font-family: var(--mono);
		font-size: 12.5px;
		font-weight: 600;
		color: var(--fg);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 6px 10px;
		min-width: 180px;
	}
	.tz:focus-visible {
		outline: none;
		border-color: var(--accent-dim);
		box-shadow: 0 0 0 3px var(--accent-glow);
	}
	.btn-ghost {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		padding: 7px 12px;
		font-size: 12px;
		font-weight: 600;
		font-family: var(--mono);
		color: var(--fg);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		transition: border-color 0.15s, color 0.15s, background 0.15s;
	}
	.btn-ghost:hover {
		border-color: var(--accent-dim);
		color: var(--accent);
	}

	/* Cycle-1a: UTC quick-toggle. Sits outside the picker, single click
	   flips state. Active styling when current tz === 'UTC' so the
	   bi-state is visible. */
	.btn-utc {
		display: inline-flex;
		align-items: center;
		padding: 7px 12px;
		font-size: 12px;
		font-weight: 700;
		font-family: var(--mono);
		letter-spacing: 0.08em;
		color: var(--muted);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		transition: border-color 0.15s, color 0.15s, background 0.15s;
	}
	.btn-utc:hover {
		border-color: var(--accent-dim);
		color: var(--fg);
	}
	.btn-utc.active {
		color: #0a0b0d;
		background: var(--accent);
		border-color: var(--accent);
		box-shadow: 0 0 22px -6px var(--accent-glow);
	}
	.btn-utc.active:hover {
		background: var(--accent-dim);
		border-color: var(--accent-dim);
	}

	.hero {
		flex: 1;
		padding-top: 24px;
		padding-bottom: 56px;
	}
	.eyebrow {
		margin: 0 0 8px;
		font-family: var(--mono);
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.2em;
		color: var(--accent-dim);
	}
	h1 {
		font-size: clamp(36px, 4.6vw, 58px);
		margin: 0;
	}
	.accent {
		color: var(--accent);
		text-shadow: 0 0 38px var(--accent-glow);
	}
	.sub {
		margin: 16px 0 28px;
		max-width: 44em;
		color: var(--muted);
		font-size: 14.5px;
		line-height: 1.7;
	}

	.editor {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0;
		max-width: 720px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
		background: var(--surface);
		transition: border-color 0.15s, box-shadow 0.15s;
	}
	.editor:focus-within {
		border-color: var(--accent-dim);
		box-shadow: 0 0 0 4px var(--accent-glow);
	}
	.editor.err {
		border-color: color-mix(in srgb, #ff6b6b 45%, var(--border));
	}
	.expr {
		background: transparent;
		border: 0;
		padding: 16px 18px;
		font-family: var(--mono);
		font-size: 18px;
		font-weight: 600;
		color: var(--accent);
		letter-spacing: 0.01em;
		outline: none;
		min-width: 0;
	}
	.expr::placeholder {
		color: var(--text-faint);
	}
	.btn-copy {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		padding: 12px 16px;
		border: 0;
		border-left: 1px solid var(--border);
		background: var(--surface-2);
		color: var(--muted);
		font-family: var(--mono);
		font-size: 12.5px;
		font-weight: 600;
		transition: color 0.15s, background 0.15s;
	}
	.btn-copy:hover {
		color: var(--accent);
		background: var(--surface-3);
	}

	.human {
		margin: 16px 0 8px;
		display: inline-flex;
		align-items: center;
		gap: 10px;
		font-size: 15px;
		font-weight: 500;
		color: var(--fg);
	}
	.dot {
		color: var(--accent);
		font-size: 10px;
		text-shadow: 0 0 8px var(--accent-glow);
	}
	.err-card {
		margin: 16px 0 8px;
		display: flex;
		align-items: flex-start;
		gap: 12px;
		max-width: 720px;
		padding: 12px 14px;
		border: 1px solid color-mix(in srgb, #ff6b6b 30%, var(--border));
		background: color-mix(in srgb, #ff6b6b 6%, var(--surface));
		border-radius: var(--radius-sm);
	}
	.err-ico {
		color: #ff8080;
		flex: none;
		margin-top: 1px;
	}
	.err-body {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
	}
	.err-msg {
		font-family: var(--mono);
		font-size: 13px;
		color: var(--fg);
		font-weight: 600;
	}
	.err-hint {
		font-size: 12px;
		color: var(--muted);
		line-height: 1.5;
	}

	.grid {
		margin-top: 36px;
		display: grid;
		grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
		gap: 24px;
	}
	.bhead {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-bottom: 12px;
	}
	.bhead h2 {
		font-size: 16px;
		font-family: var(--display);
		font-weight: 700;
	}
	.zone-tag {
		font-family: var(--mono);
		font-size: 11px;
		font-weight: 600;
		color: var(--accent);
		background: var(--accent-glow);
		border-radius: 4px;
		padding: 2px 8px;
	}
	.hint {
		font-size: 11.5px;
		color: var(--text-faint);
	}
	.muted {
		color: var(--text-faint);
		font-size: 13px;
		margin: 0;
	}

	.firings,
	.patterns {
		padding: 16px 18px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: var(--radius);
	}

	.fire-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.fire-row {
		display: grid;
		grid-template-columns: 26px minmax(0, 0.8fr) minmax(0, 1.2fr);
		align-items: baseline;
		gap: 10px;
		padding: 9px 10px;
		background: var(--surface-2);
		border: 1px solid var(--border-soft);
		border-radius: var(--radius-sm);
		font-variant-numeric: tabular-nums;
	}
	.fire-idx {
		font-family: var(--mono);
		font-size: 11px;
		font-weight: 700;
		color: var(--accent);
	}
	.fire-rel {
		font-family: var(--mono);
		font-size: 12.5px;
		color: var(--fg);
		font-weight: 600;
	}
	.fire-abs {
		font-family: var(--mono);
		font-size: 12px;
		color: var(--muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.chip-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.chip {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		width: 100%;
		padding: 10px 12px;
		background: var(--surface-2);
		border: 1px solid var(--border-soft);
		border-radius: var(--radius-sm);
		color: var(--fg);
		font-family: var(--mono);
		font-size: 12.5px;
		text-align: left;
		transition: border-color 0.15s, background 0.15s, color 0.15s;
	}
	.chip:hover {
		border-color: var(--accent-dim);
		background: var(--surface-3);
	}
	.chip.active {
		border-color: var(--accent-dim);
		background: color-mix(in srgb, var(--accent) 8%, var(--surface-2));
	}
	.chip.active .chip-label {
		color: var(--accent);
	}
	.chip-label {
		font-weight: 600;
		color: var(--fg);
	}
	.chip-expr {
		font-family: var(--mono);
		font-size: 11.5px;
		color: var(--muted);
		background: transparent;
		padding: 0;
	}

	.foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
		padding-top: 18px;
		padding-bottom: 26px;
		border-top: 1px solid var(--border-soft);
		font-size: 12px;
		color: var(--muted);
	}
	.foot .family {
		color: var(--muted);
	}
	.foot .family a {
		color: var(--accent);
	}
	.foot .dim {
		color: var(--text-faint);
	}
	@media (max-width: 640px) {
		.foot {
			flex-direction: column;
			align-items: flex-start;
			gap: 6px;
		}
	}

	@media (max-width: 820px) {
		.grid {
			grid-template-columns: 1fr;
			gap: 16px;
		}
		.head-right {
			gap: 8px;
		}
		.tz {
			min-width: 140px;
		}
		h1 {
			font-size: clamp(30px, 8vw, 42px);
		}
		.fire-row {
			grid-template-columns: 22px 1fr;
			grid-template-areas: 'idx rel' '.   abs';
		}
		.fire-idx {
			grid-area: idx;
		}
		.fire-rel {
			grid-area: rel;
		}
		.fire-abs {
			grid-area: abs;
			white-space: normal;
		}
	}
</style>
