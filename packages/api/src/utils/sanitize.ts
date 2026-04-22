/**
 * String sanitization utilities (SEC-L3).
 *
 * React escapes DOM bindings automatically, but stored data may be rendered
 * through non-React paths (PDF generation, email templates, WhatsApp links),
 * so escape HTML-significant characters on the way into the database.
 *
 * For search inputs that feed Postgres `ilike`/`or` expressions, use
 * {@link sanitizeSearchTerm} instead — it enforces an allowlist of
 * alphanumeric + space + hyphen.
 */

const HTML_ENTITY_MAP: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
};

export function sanitizeHtml(input: string | undefined | null): string | undefined {
    if (!input) return undefined;
    // `&` must run first so that subsequent replacements don't double-escape it.
    return input.replace(/[&<>"'`/]/g, (ch) => HTML_ENTITY_MAP[ch] ?? ch);
}

/**
 * Strict allowlist sanitizer for search terms passed into Postgres `ilike`.
 * Strips everything except letters, digits, space, and hyphen. Also collapses
 * whitespace and trims — a blank result signals "no search filter".
 *
 * Used in clients/invoices search (SEC-M1) to prevent filter injection via
 * `,` (OR-expression terminator in PostgREST) and SQL wildcards.
 */
export function sanitizeSearchTerm(input: string | undefined | null): string {
    if (!input) return '';
    // ASCII-safe allowlist: letters, digits, space, hyphen.
    // Kept ASCII-only (no `\p{L}` / `u` flag) because the tsconfig base targets
    // an older lib — acceptable since invoice_number / phone / postcode searches
    // are all ASCII. Names with accents just lose those characters in the filter.
    return input
        .replace(/[^A-Za-z0-9\s-]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100);
}
