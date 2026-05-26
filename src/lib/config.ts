// Operator-tunable runtime config. For cycle 1, the only app-readable value
// is PUBLIC_BASE_URL — PORT and HOST are consumed directly by SvelteKit's
// adapter-node entrypoint, not by app code. As later cycles introduce env-
// driven knobs (rate limits, schedule history size, etc.) they extend CONFIG
// by re-using envInt / envUrl below.
//
// Misconfiguration is loud, not silent: an unparseable or out-of-bounds env
// value throws at startup so a typo in deploy config fails fast instead of
// quietly running with the wrong setting.
//
// EnvSource injection pattern (carried forward from tinywebhook cycle-4):
// every helper accepts an optional `env` parameter so tests can drive the
// parser with a controlled object instead of mutating process.env. The
// PROCESS_ENV default keeps production callers ergonomic.
//
// This file is server-only (read via $lib/config from +server.ts handlers
// and $lib/server/* code). process.env access here is safe.

export type EnvSource = Record<string, string | undefined>;

const PROCESS_ENV: EnvSource =
	typeof process !== 'undefined' && process.env ? (process.env as EnvSource) : {};

export interface IntBounds {
	min?: number;
	max?: number;
}

/**
 * Parse an integer env var with a default. Throws a descriptive error if the
 * value is set but not a valid integer or falls outside provided bounds.
 *
 * Exported so tests can exercise the parser directly with a controlled env
 * object, rather than mutating process.env at runtime.
 */
export function envInt(
	name: string,
	defaultValue: number,
	bounds: IntBounds = {},
	env: EnvSource = PROCESS_ENV
): number {
	const raw = env[name];
	if (raw === undefined || raw === '') return defaultValue;
	const trimmed = raw.trim();
	if (!/^-?\d+$/.test(trimmed)) {
		throw new Error(`config: env ${name}=${JSON.stringify(raw)} must be an integer`);
	}
	const n = Number(trimmed);
	if (!Number.isFinite(n)) {
		throw new Error(`config: env ${name}=${JSON.stringify(raw)} is not a finite number`);
	}
	if (bounds.min !== undefined && n < bounds.min) {
		throw new Error(`config: env ${name}=${n} is below minimum ${bounds.min}`);
	}
	if (bounds.max !== undefined && n > bounds.max) {
		throw new Error(`config: env ${name}=${n} is above maximum ${bounds.max}`);
	}
	return n;
}

/**
 * Parse a URL env var. Returns the canonical origin (scheme + host + port,
 * no trailing slash) or undefined if unset. Throws if set-but-unparseable or
 * if the operator pasted a URL with a path on it (origin-only is what
 * downstream URL concatenation expects).
 */
export function envUrl(name: string, env: EnvSource = PROCESS_ENV): string | undefined {
	const raw = env[name];
	if (raw === undefined || raw === '') return undefined;
	let u: URL;
	try {
		u = new URL(raw);
	} catch {
		throw new Error(`config: env ${name}=${JSON.stringify(raw)} is not a parseable URL`);
	}
	if (u.pathname !== '/' && u.pathname !== '') {
		throw new Error(
			`config: env ${name}=${JSON.stringify(raw)} must be an origin only ` +
				`(no path); got pathname=${JSON.stringify(u.pathname)}`
		);
	}
	return u.origin;
}

export const CONFIG = Object.freeze({
	/**
	 * Public origin used server-side when generating absolute share URLs.
	 * When undefined, handlers derive the origin from the incoming request.
	 * When set, this overrides — operator's word is final.
	 */
	PUBLIC_BASE_URL: envUrl('PUBLIC_BASE_URL')
});
