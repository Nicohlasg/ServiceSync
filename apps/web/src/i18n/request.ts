import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from './config';

// next-intl server-side resolver (non-prefix routing). The cookie is the only
// transport that survives Next.js server component renders; the Language
// Picker sets it client-side, and the signup/wizard mutations cascade it to
// profiles.preferred_locale so it survives device swaps.
//
// Deliberately does NOT sniff Accept-Language — masterplan §4.1 requires the
// user to pick explicitly to avoid wrong defaults for multilingual households.

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(cookieValue) ? cookieValue : defaultLocale;

  const messages = (await import(`../../messages/${locale}.json`)).default;

  return {
    locale,
    messages,
    timeZone: 'Asia/Singapore',
    now: new Date(),
  };
});
