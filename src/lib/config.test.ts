// Helper-level tests for envInt + envUrl. The CONFIG object itself reads
// process.env at module load, which makes it hostile to test directly — the
// EnvSource injection pattern lets us validate every parser edge case with
// controlled inputs and no process.env mutation. Carried forward from the
// tinywebhook cycle-4 methodology.

import { describe, expect, it } from 'vitest';
import { envInt, envUrl } from './config';

describe('envInt', () => {
	it('returns default when unset', () => {
		expect(envInt('X', 7, {}, {})).toBe(7);
	});

	it('returns default when empty string (operator cleared the value)', () => {
		expect(envInt('X', 7, {}, { X: '' })).toBe(7);
	});

	it('parses a positive integer', () => {
		expect(envInt('X', 7, {}, { X: '42' })).toBe(42);
	});

	it('parses a negative integer', () => {
		expect(envInt('X', 7, {}, { X: '-3' })).toBe(-3);
	});

	it('trims whitespace before parsing', () => {
		expect(envInt('X', 7, {}, { X: '  9  ' })).toBe(9);
	});

	it('throws on non-integer (decimal)', () => {
		expect(() => envInt('X', 7, {}, { X: '3.14' })).toThrow(/must be an integer/);
	});

	it('throws on non-integer (text)', () => {
		expect(() => envInt('X', 7, {}, { X: 'twelve' })).toThrow(/must be an integer/);
	});

	it('throws when below minimum bound', () => {
		expect(() => envInt('X', 7, { min: 1 }, { X: '0' })).toThrow(/below minimum 1/);
	});

	it('throws when above maximum bound', () => {
		expect(() => envInt('X', 7, { max: 10 }, { X: '11' })).toThrow(/above maximum 10/);
	});

	it('accepts a value exactly at minimum', () => {
		expect(envInt('X', 7, { min: 5 }, { X: '5' })).toBe(5);
	});

	it('accepts a value exactly at maximum', () => {
		expect(envInt('X', 7, { max: 10 }, { X: '10' })).toBe(10);
	});

	it('error message includes the offending variable name', () => {
		expect(() => envInt('MY_LIMIT', 7, {}, { MY_LIMIT: 'nope' })).toThrow(/MY_LIMIT/);
	});
});

describe('envUrl', () => {
	it('returns undefined when unset', () => {
		expect(envUrl('X', {})).toBeUndefined();
	});

	it('returns undefined when empty string', () => {
		expect(envUrl('X', { X: '' })).toBeUndefined();
	});

	it('parses an https origin', () => {
		expect(envUrl('X', { X: 'https://cron.dexli.dev' })).toBe('https://cron.dexli.dev');
	});

	it('parses an http origin with explicit port', () => {
		expect(envUrl('X', { X: 'http://localhost:3000' })).toBe('http://localhost:3000');
	});

	it('strips a trailing slash via URL normalization', () => {
		expect(envUrl('X', { X: 'https://cron.dexli.dev/' })).toBe('https://cron.dexli.dev');
	});

	it('throws on unparseable input', () => {
		expect(() => envUrl('X', { X: 'not a url' })).toThrow(/not a parseable URL/);
	});

	it('throws when a path is present (origin-only contract)', () => {
		expect(() => envUrl('X', { X: 'https://cron.dexli.dev/share' })).toThrow(
			/must be an origin only/
		);
	});

	it('error message includes the offending variable name', () => {
		expect(() => envUrl('PUBLIC_BASE_URL', { PUBLIC_BASE_URL: 'gibberish' })).toThrow(
			/PUBLIC_BASE_URL/
		);
	});
});
