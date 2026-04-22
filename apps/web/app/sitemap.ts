import type { MetadataRoute } from 'next';

/**
 * LR-4.2 — sitemap for the public surface. Provider-profile URLs (/p/[slug])
 * are intentionally excluded from this static sitemap: they are user-generated
 * and the per-profile opt-in for search indexing lives on the profile itself.
 * Once that opt-in is live we can enumerate published slugs from Supabase
 * here and regenerate on ISR.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://servicesync.sg';
  const now = new Date();

  return [
    { url: `${base}/`,        lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${base}/signup`,  lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/login`,   lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${base}/terms`,   lastModified: now, changeFrequency: 'yearly',  priority: 0.2 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: 'yearly',  priority: 0.2 },
  ];
}
