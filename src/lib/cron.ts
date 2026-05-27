// Boundary layer between the UI and the third-party cron libs (cronstrue
// for the human-readable interpretation, cron-parser for next-firings).
// Components never import those libs directly — keeps the swap surface
// small if we ever replace one, and gives us a single place for the
// field-specific error formatting (bar item 4) that neither lib provides
// directly.

import cronstrue from 'cronstrue';
import { CronExpressionParser } from 'cron-parser';

export type CronField = 'minute' | 'hour' | 'day-of-month' | 'month' | 'day-of-week';

export interface Firing {
	date: Date;
	/** ISO 8601 UTC; used for keying + headless assertions. */
	iso: string;
	/** Loose human relative, e.g. "in 3 hours" / "in 2 days". */
	relative: string;
	/** Localized absolute timestamp in the chosen tz, e.g. "Mon, 25 May 2026, 09:00 CET". */
	absolute: string;
}

export type CronResult =
	| { ok: true; human: string; firings: Firing[] }
	| { ok: false; message: string; field?: CronField; hint?: string };

const FIELD_DEFS: { name: CronField; min: number; max: number; aliases?: Record<string, number> }[] = [
	{ name: 'minute', min: 0, max: 59 },
	{ name: 'hour', min: 0, max: 23 },
	{ name: 'day-of-month', min: 1, max: 31 },
	{
		name: 'month',
		min: 1,
		max: 12,
		aliases: {
			JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
			JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12
		}
	},
	{
		// Standard cron allows both 0 and 7 for Sunday — we accept both.
		name: 'day-of-week',
		min: 0,
		max: 7,
		aliases: { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 }
	}
];

/**
 * Single entry point: interpret a cron expression in a given tz. Returns
 * either { ok: true, human, firings } or { ok: false, message, field?, hint? }.
 * Same call shape regardless of which lib threw — the components only
 * branch on `ok`.
 */
export function interpret(expression: string, tz: string, now: Date = new Date()): CronResult {
	const trimmed = expression.trim();
	if (!trimmed) {
		return { ok: false, message: 'Enter a cron expression to begin.' };
	}

	// Field-shape check first so we can name the specific bad field BEFORE
	// the third-party libs throw a generic "invalid syntax" message.
	const shape = validateShape(trimmed);
	if (!shape.ok) return shape;

	let human: string;
	try {
		human = cronstrue.toString(trimmed, {
			use24HourTimeFormat: false,
			throwExceptionOnParseError: true
		});
	} catch (e) {
		return {
			ok: false,
			message: errorMessage(e),
			hint: 'cronstrue could not interpret this expression. Check the field shape.'
		};
	}

	let firings: Firing[];
	try {
		const it = CronExpressionParser.parse(trimmed, { tz, currentDate: now });
		firings = [];
		for (let i = 0; i < 5; i++) {
			const d = it.next().toDate();
			firings.push({
				date: d,
				iso: d.toISOString(),
				relative: formatRelative(d, now),
				absolute: formatAbsolute(d, tz)
			});
		}
	} catch (e) {
		return {
			ok: false,
			message: errorMessage(e),
			hint: 'cron-parser could not iterate this expression in the selected timezone.'
		};
	}

	return { ok: true, human, firings };
}

/**
 * Shape-level validation: split into 5 fields, walk each token (handles `*`,
 * step-syntax, `A-B`, ranges with step, comma-lists, aliased names), and
 * return the FIRST field-specific error with a corrective hint. Bar item 4.
 */
function validateShape(expression: string): CronResult {
	const fields = expression.split(/\s+/).filter(Boolean);
	if (fields.length !== 5) {
		return {
			ok: false,
			message: `Standard cron has 5 fields; got ${fields.length}.`,
			hint: 'Expected: minute hour day-of-month month day-of-week'
		};
	}

	for (let i = 0; i < 5; i++) {
		const err = validateField(fields[i], FIELD_DEFS[i]);
		if (err) return err;
	}

	return { ok: true, human: '', firings: [] }; // sentinel — real result builds after this
}

function validateField(
	raw: string,
	def: { name: CronField; min: number; max: number; aliases?: Record<string, number> }
): CronResult | null {
	if (raw === '*') return null;
	if (raw === '?' && (def.name === 'day-of-month' || def.name === 'day-of-week')) return null;

	// Split on commas to handle lists; each entry can be a number, range,
	// range-with-step, or `*/N`.
	for (const part of raw.split(',')) {
		const stepMatch = part.match(/^([*0-9A-Z\-]+)\/(\d+)$/i);
		const body = stepMatch ? stepMatch[1] : part;
		const step = stepMatch ? Number(stepMatch[2]) : null;

		if (step !== null && (step <= 0 || !Number.isFinite(step))) {
			return {
				ok: false,
				field: def.name,
				message: `${capitalize(def.name)} step '${stepMatch![2]}' must be a positive integer.`,
				hint: `Valid step example: */5 (every 5 ${def.name === 'minute' ? 'minutes' : def.name + 's'})`
			};
		}

		if (body === '*') continue; // `*/N` body is OK

		const rangeMatch = body.match(/^([0-9A-Z]+)-([0-9A-Z]+)$/i);
		if (rangeMatch) {
			const a = resolveNumeric(rangeMatch[1], def);
			const b = resolveNumeric(rangeMatch[2], def);
			if (a === null || b === null) {
				return outOfRange(rangeMatch[1] + '-' + rangeMatch[2], def);
			}
			if (a > b) {
				return {
					ok: false,
					field: def.name,
					message: `${capitalize(def.name)} range '${a}-${b}' is descending.`,
					hint: 'Ranges must go low-to-high, e.g. 1-5 (not 5-1).'
				};
			}
			continue;
		}

		const n = resolveNumeric(body, def);
		if (n === null) return outOfRange(body, def);
	}

	return null;
}

function resolveNumeric(
	token: string,
	def: { min: number; max: number; aliases?: Record<string, number> }
): number | null {
	if (def.aliases && def.aliases[token.toUpperCase()] !== undefined) {
		return def.aliases[token.toUpperCase()];
	}
	const n = Number(token);
	if (!Number.isInteger(n) || n < def.min || n > def.max) return null;
	return n;
}

function outOfRange(
	value: string,
	def: { name: CronField; min: number; max: number; aliases?: Record<string, number> }
): CronResult {
	const aliasList = def.aliases ? `, or aliases ${Object.keys(def.aliases).slice(0, 3).join('/')}…` : '';
	return {
		ok: false,
		field: def.name,
		message: `${capitalize(def.name)} field invalid: '${value}' is not ${def.min}-${def.max}.`,
		hint: `Valid values: ${def.min} through ${def.max}${aliasList}.`
	};
}

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

function errorMessage(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}

/**
 * Loose human relative — "in 23s", "in 4m", "in 3h 12m", "in 2 days".
 * Past timestamps render "past" (shouldn't happen for next-firings but
 * defensive). Kept dependency-free; reading 5 of these stacked needs
 * to be fast to scan.
 */
export function formatRelative(d: Date, now: Date = new Date()): string {
	const ms = d.getTime() - now.getTime();
	if (ms <= 0) return 'past';
	const s = Math.floor(ms / 1000);
	if (s < 60) return `in ${s}s`;
	const m = Math.floor(s / 60);
	if (m < 60) return m === 1 ? 'in 1 minute' : `in ${m} minutes`;
	const h = Math.floor(m / 60);
	if (h < 24) {
		const rem = m - h * 60;
		return rem === 0 ? (h === 1 ? 'in 1 hour' : `in ${h} hours`) : `in ${h}h ${rem}m`;
	}
	const days = Math.floor(h / 24);
	const remH = h - days * 24;
	if (days < 7) {
		return remH === 0 ? (days === 1 ? 'in 1 day' : `in ${days} days`) : `in ${days}d ${remH}h`;
	}
	const weeks = Math.floor(days / 7);
	return weeks === 1 ? 'in 1 week' : `in ${weeks} weeks`;
}

/**
 * Localized absolute string in the chosen tz, suitable for sitting next to
 * the relative line. Uses Intl with explicit timeZone so server-rendered
 * output matches client without the "no tz" warning.
 */
export function formatAbsolute(d: Date, tz: string): string {
	try {
		return new Intl.DateTimeFormat(undefined, {
			timeZone: tz,
			weekday: 'short',
			year: 'numeric',
			month: 'short',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false,
			timeZoneName: 'short'
		}).format(d);
	} catch {
		// Unknown tz — fall back to UTC ISO so we never crash the UI.
		return d.toISOString();
	}
}
