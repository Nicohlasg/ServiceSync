/**
 * OneMap SG token manager with lazy auto-refresh.
 *
 * OneMap tokens expire every 72 hours. This module keeps a module-level cache
 * and re-authenticates automatically when the token is within 1 hour of expiry.
 *
 * Required env vars for auto-refresh:
 *   ONEMAP_EMAIL    — your OneMap account email
 *   ONEMAP_PASSWORD — your OneMap account password
 *
 * Fallback: if credentials are absent, ONEMAP_TOKEN (static) is used instead.
 * Register for a free account at: https://www.onemap.gov.sg/apidocs/apidocs
 */

let cachedToken: string | null = null;
let tokenExpiresAt = 0; // Unix ms

export async function getOneMapToken(): Promise<string | null> {
    const now = Date.now();

    // Return cached token if still valid with 1-hour buffer
    if (cachedToken && now < tokenExpiresAt - 3_600_000) {
        return cachedToken;
    }

    const email = process.env.ONEMAP_EMAIL;
    const password = process.env.ONEMAP_PASSWORD;

    if (email && password) {
        try {
            const res = await fetch('https://www.onemap.gov.sg/api/auth/post/getToken', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
                cache: 'no-store',
            });

            if (res.ok) {
                const data = await res.json() as { access_token?: string; expiry_timestamp?: string };
                if (data.access_token) {
                    cachedToken = data.access_token;
                    // expiry_timestamp is Unix seconds as a float string, e.g. "1234567890.123"
                    tokenExpiresAt = data.expiry_timestamp
                        ? parseFloat(data.expiry_timestamp) * 1000
                        : now + 72 * 60 * 60 * 1000;
                    return cachedToken;
                }
            }
        } catch {
            // fall through to static env token
        }
    }

    // Fallback: static token from env (no auto-refresh)
    return process.env.ONEMAP_TOKEN ?? null;
}
