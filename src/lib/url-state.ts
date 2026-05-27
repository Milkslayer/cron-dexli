// URL state sync (bar item 7). `?e=<urlencoded expr>&tz=<tz id>` reads on
// load and writes on edit. replaceState (not pushState) so live-typing
// doesn't flood the history stack. Debounced so rapid keystrokes coalesce
// into one URL update per ~200ms.
//
// Server-render safe: every function noops when `window` is undefined.

const DEBOUNCE_MS = 200;
let writeTimer: ReturnType<typeof setTimeout> | undefined;

export interface UrlState {
	expression: string;
	tz: string;
}

/** Read whatever shareable state the URL currently advertises. */
export function readUrlState(): Partial<UrlState> {
	if (typeof window === 'undefined') return {};
	const params = new URLSearchParams(window.location.search);
	const out: Partial<UrlState> = {};
	const e = params.get('e');
	const tz = params.get('tz');
	if (e !== null) out.expression = e;
	if (tz !== null && tz !== '') out.tz = tz;
	return out;
}

/**
 * Debounced replaceState writer. Omits empty fields so the URL stays
 * clean for the empty-default case. Always replaceState — pushState
 * would let every keystroke pollute the back stack.
 */
export function writeUrlState(state: UrlState): void {
	if (typeof window === 'undefined') return;
	clearTimeout(writeTimer);
	writeTimer = setTimeout(() => {
		const params = new URLSearchParams();
		if (state.expression && state.expression.trim()) {
			params.set('e', state.expression);
		}
		if (state.tz) {
			params.set('tz', state.tz);
		}
		const qs = params.toString();
		const next = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
		// Avoid a redundant replaceState if nothing actually changed — keeps
		// devtools / dev-server log noise down.
		if (next !== window.location.pathname + window.location.search) {
			window.history.replaceState({}, '', next);
		}
	}, DEBOUNCE_MS);
}

/** Force-flush any pending replaceState (e.g. on copy-share-link). */
export function flushUrlState(state: UrlState): void {
	if (typeof window === 'undefined') return;
	clearTimeout(writeTimer);
	const params = new URLSearchParams();
	if (state.expression && state.expression.trim()) params.set('e', state.expression);
	if (state.tz) params.set('tz', state.tz);
	const qs = params.toString();
	const next = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
	window.history.replaceState({}, '', next);
}

/**
 * Fully-qualified shareable URL — for the copy-share button.
 *
 * Honors an operator-set canonical origin (PUBLIC_BASE_URL) if one is
 * provided, falling back to window.location.origin. Mirrors tinywebhook
 * cycle-4a's canonical-URL discipline so the dexli.dev family is
 * consistent: a share link minted on a preview/internal host still names
 * the operator's canonical hostname. The path component always comes from
 * the current page (cron has a single route, "/").
 */
export function shareUrl(state: UrlState, baseUrl?: string | null): string {
	if (typeof window === 'undefined') return '';
	const params = new URLSearchParams();
	if (state.expression && state.expression.trim()) params.set('e', state.expression);
	if (state.tz) params.set('tz', state.tz);
	const qs = params.toString();
	const origin = (baseUrl && baseUrl.trim()) || window.location.origin;
	return qs
		? `${origin}${window.location.pathname}?${qs}`
		: `${origin}${window.location.pathname}`;
}
