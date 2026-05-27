// Click-to-populate pattern library (bar item 5). Eight common cron shapes,
// curated so a brand-new user can land on one of these for ~80% of the
// realistic scheduling intents without writing any cron themselves. Order
// is rough-cadence-ascending so the list reads top→bottom as "more often"
// to "less often". Labels are short and verb-first so they scan cleanly
// as chips. Expressions are standard 5-field cron (m h d m w).
//
// frozen to discourage accidental in-place mutation downstream.

export interface CronPattern {
	/** Short human label used as chip text. */
	label: string;
	/** Standard 5-field cron expression. */
	expr: string;
	/** One-line context shown in tooltip / hover state. */
	hint: string;
}

export const PATTERNS: readonly CronPattern[] = Object.freeze([
	{ label: 'Every minute', expr: '* * * * *', hint: 'Runs every 60 seconds.' },
	{ label: 'Every 5 minutes', expr: '*/5 * * * *', hint: '12 runs per hour.' },
	{ label: 'Every 15 minutes', expr: '*/15 * * * *', hint: '4 runs per hour, on the quarter.' },
	{ label: 'Hourly (on the hour)', expr: '0 * * * *', hint: '24 runs per day, at :00.' },
	{ label: 'Weekday mornings (9 AM)', expr: '0 9 * * 1-5', hint: 'Mon–Fri at 09:00 local.' },
	{ label: 'Daily at midnight', expr: '0 0 * * *', hint: 'Once a day, 00:00 local.' },
	{ label: 'Sundays at noon', expr: '0 12 * * 0', hint: 'Once a week, Sunday 12:00 local.' },
	{ label: 'First of the month', expr: '0 0 1 * *', hint: 'Once a month, 1st at 00:00.' }
]);
