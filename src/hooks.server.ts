// Global server hook — adds non-CSP hardening headers to every response (the
// CSP header itself is emitted by SvelteKit per svelte.config.js
// kit.csp configuration).
//
// Three always-on hardening headers:
//   - X-Content-Type-Options: nosniff  (no MIME-sniffing surprises)
//   - Referrer-Policy:       no-referrer  (don't leak the cron expression
//                                          in the URL via Referer)
//   - X-Frame-Options:       DENY  (no clickjacking embed)
//
// DIVERGENCE FROM TINYWEBHOOK — Cache-Control: no-store is intentionally
// OMITTED here.
//
// Tinywebhook forced no-store on every response because dashboard pages
// contained per-inbox secrets (Bearer keys held in localStorage, captured
// webhook bodies). Cron has no secrets — the entire app surface is a pure
// function of the URL (cron expression in path or query → next-fire times
// in the response). Default cache semantics serve the product:
//
//   - Bookmark + share-URL flows render instantly from disk cache.
//   - Back-button keeps the previously-computed schedule visible without a
//     round-trip — the user's input wasn't lost.
//   - CDN edge caching (when present) absorbs popular share URLs without
//     hitting the origin.
//
// The sub-30s "no-instructions" flow in the bar benefits from cache hits,
// not from cache busts. Adding no-store would actively fight that UX for no
// safety gain.
//
// If a future surface introduces per-user state (saved schedules tied to an
// auth cookie, draft history, etc.), revisit this decision on a per-route
// basis rather than reinstating a blanket no-store.

import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	const headers = response.headers;

	if (!headers.has('X-Content-Type-Options')) {
		headers.set('X-Content-Type-Options', 'nosniff');
	}
	if (!headers.has('Referrer-Policy')) {
		headers.set('Referrer-Policy', 'no-referrer');
	}
	if (!headers.has('X-Frame-Options')) {
		headers.set('X-Frame-Options', 'DENY');
	}

	return response;
};
