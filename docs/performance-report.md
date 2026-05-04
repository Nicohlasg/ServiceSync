# Performance Analysis Report - ServiceSync V2

**Date:** 2026-04-18
**Scope:** Bundle size, dynamic imports, Next.js config, Turbo caching

---

## Changes Applied

### 1. Lazy-loaded non-critical UI overlays (Providers.tsx)

**File:** `apps/web/src/components/Providers.tsx`

`PwaInstallPrompt`, `OfflineDetector`, and `CookieConsent` were statically imported into the root Providers component, meaning they were included in the initial JS bundle for every single page. All three render `null` on mount and only show UI after browser events or timeouts.

**Change:** Converted to `next/dynamic` with `{ ssr: false }`. These chunks now load asynchronously after the main bundle, removing ~8-12 KB from the critical path.

### 2. Added optimizePackageImports (next.config.mjs)

**File:** `apps/web/next.config.mjs`

Added `experimental.optimizePackageImports` for:
- `lucide-react` -- barrel-exported icon library; only used icons are now included
- `date-fns` -- barrel-exported utility library
- `recharts` -- only `chart.tsx` uses it via `import *`
- `framer-motion` -- large animation library used across ~10 components
- `@radix-ui/react-icons` -- icon library

This tells Next.js to transform barrel imports into direct module imports at build time, eliminating dead code from large libraries.

### 3. Improved Turbo cache specificity (turbo.json)

**File:** `turbo.json`

Added explicit `inputs` arrays for `build`, `lint`, and `typecheck` tasks and empty `outputs` for lint/typecheck. This prevents unnecessary cache invalidation when non-source files change (e.g., editing docs, scripts, or other non-code files).

---

## Existing Optimizations (Already Good)

### serverExternalPackages
The `@react-pdf/*` family (12 packages) is already correctly listed in `serverExternalPackages`, preventing these heavy Node-only packages from being bundled into client-side JS. Puppeteer packages are also correctly excluded.

### Security headers
All recommended security headers are in place. CSP is handled dynamically via middleware (nonce-based).

### Font loading
Using `next/font/google` with Inter, which is optimal -- it self-hosts the font and avoids layout shift.

### tRPC batch link
HTTP batch linking is enabled, reducing network requests when multiple tRPC calls fire simultaneously.

---

## Remaining Recommendations (Manual Action Required)

### HIGH PRIORITY

#### H1. Remove dead dependencies from package.json

**File:** `apps/web/package.json`

| Package | Size (gzipped) | Status |
|---------|---------------|--------|
| `jspdf` | ~280 KB | Never imported anywhere in `src/`. Completely unused. |
| `motion` (v10) | ~50 KB | Never imported. Only `framer-motion` is used. |

**Action:** Run `npm uninstall jspdf motion` from `apps/web/`.

Estimated savings: **~330 KB** removed from `node_modules`, and eliminates risk of accidental bundling.

#### H2. framer-motion in button.tsx forces it into every page

**File:** `apps/web/src/components/ui/button.tsx`

The `Button` component imports `motion`, `useReducedMotion`, and `HTMLMotionProps` from `framer-motion`. Since `Button` is used on virtually every page, framer-motion (~45 KB gzipped) is included in every page's JS bundle.

**Options (in order of impact):**

1. **Replace with CSS transitions** -- The button only uses `whileTap={{ scale: 0.96 }}` and a spring transition. This can be replicated with `active:scale-[0.96] transition-transform` in Tailwind, which is already done for the `asChild` path. This would eliminate framer-motion from the critical bundle entirely (it would only load for pages that use modals/animations).

2. **Accept the cost** -- If the spring physics feel is truly essential for the brand, keep it but ensure `optimizePackageImports` (already added) minimizes the tree-shaken size.

#### H3. Duplicate animation packages

Both `framer-motion` (^12.34.4) and `motion` (^10.18.0) are listed. The `motion` package is the successor to `framer-motion` but they are NOT the same. Since the codebase only imports from `framer-motion`, `motion` is dead weight.

### MEDIUM PRIORITY

#### M1. Unused UI components still contribute to tree-shaking overhead

These components exist but are never imported by any page or feature:
- `apps/web/src/components/ui/chart.tsx` (imports `recharts`)
- `apps/web/src/components/ui/carousel.tsx` (imports `embla-carousel-react`)
- `apps/web/src/components/ui/ios-picker.tsx` (imports `framer-motion`)

While Next.js tree-shaking should exclude them, they add maintenance burden. Consider removing if no future use is planned, or keep them as shadcn primitives ready for use.

#### M2. Consider standalone output mode for Docker

If deploying via Docker, adding `output: 'standalone'` to `next.config.mjs` significantly reduces image size by only including necessary production files.

```js
// next.config.mjs
const nextConfig = {
  output: 'standalone', // Add if deploying to Docker/containers
  // ...
};
```

#### M3. Image optimization format

Consider adding explicit format preferences for the image optimizer:

```js
images: {
  formats: ['image/avif', 'image/webp'],
  // ...existing remotePatterns
}
```

AVIF provides ~20-50% smaller files than WebP for photographic content.

### LOW PRIORITY

#### L1. React Query staleTime

Current `staleTime: 5000` (5 seconds) is reasonable for real-time data. For less volatile data (user profile, service categories), consider per-query staleTime overrides:

```ts
// For rarely-changing data
api.user.profile.useQuery(undefined, { staleTime: 60_000 });
```

#### L2. Sentry sourcemap conditional

Sentry sourcemaps are conditionally disabled, which is good. Ensure `@sentry/nextjs` tree-shaking is working -- Sentry can add ~30-50 KB to client bundles even when not actively uploading sourcemaps.

---

## Bundle Impact Summary

| Optimization | Estimated Savings | Status |
|-------------|-------------------|--------|
| Dynamic import overlays (Providers.tsx) | ~8-12 KB initial JS | Applied |
| optimizePackageImports (lucide, date-fns, etc.) | ~15-40 KB | Applied |
| Turbo cache inputs (faster rebuilds) | Build time | Applied |
| Remove `jspdf` + `motion` dead deps | ~330 KB node_modules | Recommended |
| framer-motion out of Button | ~45 KB per page | Recommended |
| standalone output (Docker) | ~80% smaller image | Optional |

---

## Files Modified

1. `apps/web/src/components/Providers.tsx` -- Dynamic imports for overlays
2. `apps/web/next.config.mjs` -- Added `experimental.optimizePackageImports`
3. `turbo.json` -- Added `inputs`/`outputs` for cache specificity
