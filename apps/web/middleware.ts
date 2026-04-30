import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Onboarding masterplan §4.1: `?lng=<locale>` deep-links must pre-select the
// locale. We accept the query param, persist it as a cookie, and redirect to
// the clean URL so the server render picks it up and the URL stays tidy.
const SUPPORTED_LOCALES = new Set(['en-SG', 'zh-Hans-SG', 'ms-SG', 'ta-SG']);
const LOCALE_COOKIE = 'NEXT_LOCALE';
// 1 year: locale is a preference, not a credential; long TTL is intentional.
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

// ---------------------------------------------------------------------------
// SEC-H5: Nonce-based Content-Security-Policy
// ---------------------------------------------------------------------------

const SUPABASE_ORIGIN = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://*.supabase.co';

function buildCsp(nonce: string): string {
    const isDev = process.env.NODE_ENV === 'development';
    return [
        `default-src 'self'`,
        // 'strict-dynamic' trusts scripts loaded by nonced scripts (Vercel Analytics, etc.)
        // 'unsafe-eval' only in dev for HMR / Turbopack
        `script-src 'nonce-${nonce}' 'strict-dynamic'${isDev ? ` 'unsafe-eval'` : ''}`,
        `style-src 'self' 'unsafe-inline'`,
        `img-src 'self' data: blob: https://images.unsplash.com https://*.supabase.co https://ui-avatars.com https://maps.google.com`,
        `font-src 'self'`,
        `connect-src 'self' ${SUPABASE_ORIGIN} wss://*.supabase.co https://maps.googleapis.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io https://*.sentry.io`,
        `frame-src 'self' https://maps.google.com https://www.google.com`,
        `object-src 'none'`,
        `base-uri 'self'`,
        `form-action 'self'`,
    ].join('; ');
}

function applyCsp(response: NextResponse, nonce: string) {
    response.headers.set('Content-Security-Policy', buildCsp(nonce));
}

// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest) {
    // SEC-H5: Generate per-request nonce for CSP
    const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-nonce', nonce);

    // ?lng= handshake: if a valid locale is passed in the query string AND
    // differs from the current cookie, set the cookie and redirect to the
    // clean URL so the next render resolves messages in the chosen locale.
    const lngParam = request.nextUrl.searchParams.get('lng');
    if (lngParam && SUPPORTED_LOCALES.has(lngParam)) {
        const current = request.cookies.get(LOCALE_COOKIE)?.value;
        if (current !== lngParam) {
            const cleanUrl = request.nextUrl.clone();
            cleanUrl.searchParams.delete('lng');
            const redirect = NextResponse.redirect(cleanUrl);
            redirect.cookies.set(LOCALE_COOKIE, lngParam, {
                path: '/',
                maxAge: LOCALE_COOKIE_MAX_AGE,
                sameSite: 'lax',
            });
            return redirect;
        }
    }

    let supabaseResponse = NextResponse.next({
        request: { headers: requestHeaders },
    });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    if (!supabaseUrl || !supabaseAnonKey) {
        applyCsp(supabaseResponse, nonce);
        return supabaseResponse;
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value }) =>
                    request.cookies.set(name, value)
                );
                supabaseResponse = NextResponse.next({
                    request: { headers: requestHeaders },
                });
                cookiesToSet.forEach(({ name, value, options }) =>
                    supabaseResponse.cookies.set(name, value, options)
                );
            },
        },
    });

    // Refresh session — IMPORTANT: do not remove this
    // Wrapped in try-catch so a paused/unreachable Supabase doesn't crash the middleware
    let user = null;
    try {
        const { data } = await supabase.auth.getUser();
        user = data.user;
    } catch (err) {
        // Supabase unreachable (e.g. free-tier paused) — let request through,
        // client-side AuthGuard will handle the redirect if needed
        console.warn('[middleware] Supabase auth check failed:', (err as Error).message);
        applyCsp(supabaseResponse, nonce);
        return supabaseResponse;
    }

    const { pathname } = request.nextUrl;

    // Protected routes: redirect to login if not authenticated
    if (pathname.startsWith('/dashboard') && !user) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        url.searchParams.set('redirect', pathname);
        return NextResponse.redirect(url);
    }

    // Already logged in: redirect away from /login only. We deliberately
    // allow /signup through even with an active session so that a user who
    // clicks "Create Account" from the home page can start a brand-new
    // registration without being silently forwarded back into the previous
    // session (see KI-12). The /signup page itself calls supabase.auth.signOut
    // on mount to clear that stale session before rendering the form.
    if (pathname === '/login' && user) {
        const url = request.nextUrl.clone();
        url.pathname = '/dashboard';
        return NextResponse.redirect(url);
    }

    applyCsp(supabaseResponse, nonce);
    return supabaseResponse;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization)
         * - favicon.ico
         * - public files (images, manifest, etc.)
         */
        '/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
