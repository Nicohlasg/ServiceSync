// Single source of truth for locales used by ServiceSync SG.
// Matches the CHECK constraint on profiles.preferred_locale (migration
// 20260415_onboarding_locale_progress.sql) — keep in lockstep.
//
// Masterplan: docs/masterplan_onboarding_plan.md §4.1

export const locales = ['en-SG', 'zh-Hans-SG', 'ms-SG', 'ta-SG'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en-SG';

// Cookie name used to persist a visitor's chosen locale across the site.
// Client-side Language Picker writes this; server-side getRequestConfig reads it.
// localStorage is a mirror for instant paint on subsequent same-device visits,
// but the cookie is what Next.js middleware and server components can see.
export const LOCALE_COOKIE = 'NEXT_LOCALE';

// Labels shown in the Language Picker. Native name primary, English sub-label.
// Per DESIGN_SYSTEM §3: Inter handles CJK well at body sizes; no font swap needed.
export const localeLabels: Record<Locale, { native: string; english: string }> = {
  'en-SG': { native: 'English', english: 'English' },
  'zh-Hans-SG': { native: '中文', english: 'Chinese' },
  'ms-SG': { native: 'Bahasa Melayu', english: 'Malay' },
  'ta-SG': { native: 'தமிழ்', english: 'Tamil' },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as readonly string[]).includes(value);
}
