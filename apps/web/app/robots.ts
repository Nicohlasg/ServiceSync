import type { MetadataRoute } from 'next';

/**
 * LR-4.2 — robots.txt. `/dashboard`, `/api`, and `/auth` are never useful to
 * crawl; `/p/*` provider profiles are indexed (that's the whole point).
 */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://servicesync.sg';

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/p/'],
        disallow: ['/dashboard', '/api', '/auth', '/_next'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
