// Sitemap for cron.dexli.dev. v1 = homepage only (per D1 bar item 4 scope).
// Origin from PUBLIC_BASE_URL with request-origin fallback.

import { CONFIG } from '$lib/config';

const homepageLastMod = '2026-05-28';

export const prerender = false;

export function GET({ url }: { url: URL }): Response {
	const origin = CONFIG.PUBLIC_BASE_URL || url.origin;
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
	<url>
		<loc>${origin}/</loc>
		<lastmod>${homepageLastMod}</lastmod>
		<changefreq>monthly</changefreq>
		<priority>1.0</priority>
	</url>
</urlset>
`;
	return new Response(xml, {
		headers: {
			'content-type': 'application/xml; charset=utf-8',
			'cache-control': 'public, max-age=3600'
		}
	});
}
