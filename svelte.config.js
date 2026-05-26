import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		// Cron has no webhook-receiver surface — every state-changing endpoint
		// originates in our own UI. SvelteKit's default origin-based CSRF check
		// is what we want, so we keep the default (checkOrigin: true). This is
		// where cron diverges from the tinywebhook config, which had to disable
		// CSRF to accept cross-origin webhooks.
		//
		// Strict CSP — auto mode emits per-page nonces/hashes for SvelteKit's
		// hydration inline scripts, so `script-src 'self'` holds without
		// 'unsafe-inline' for scripts. Inline style attributes from Svelte
		// components still need 'unsafe-inline' for style only — non-
		// exploitable when no untrusted content is rendered as HTML.
		csp: {
			mode: 'auto',
			directives: {
				'default-src': ['self'],
				'script-src': ['self'],
				'style-src': ['self', 'unsafe-inline'],
				'img-src': ['self', 'data:'],
				'font-src': ['self', 'data:'],
				'connect-src': ['self'],
				'object-src': ['none'],
				'frame-ancestors': ['none'],
				'base-uri': ['none'],
				'form-action': ['self']
			}
		}
	}
};

export default config;
