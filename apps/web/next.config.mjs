import { withSentryConfig } from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';

// Points next-intl at our non-prefix getRequestConfig. Keeps all existing
// routes intact — locale is resolved from the NEXT_LOCALE cookie, not the URL.
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const APP_ORIGIN = process.env.NEXT_PUBLIC_APP_URL || 'https://servicesync.sg';

const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['192.168.28.6'],
  experimental: {
    // Tree-shake barrel exports for large icon/component libraries.
    // Reduces bundle size by only including actually-used exports.
    optimizePackageImports: [
      'lucide-react',
      'date-fns',
      'recharts',
      '@radix-ui/react-icons',
      'framer-motion',
    ],
  },
  serverExternalPackages: [
    'puppeteer-core',
    '@sparticuz/chromium',
    'puppeteer',
    '@react-pdf/renderer',
    '@react-pdf/reconciler',
    '@react-pdf/layout',
    '@react-pdf/pdfkit',
    '@react-pdf/primitives',
    '@react-pdf/render',
    '@react-pdf/font',
    '@react-pdf/textkit',
    '@react-pdf/fns',
    '@react-pdf/stylesheet',
    '@react-pdf/image',
  ],
  transpilePackages: ['@servicesync/api'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'ui-avatars.com',
      },
      {
        protocol: 'https',
        hostname: 'i.pravatar.cc',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          // CSP is now set dynamically per-request in middleware.ts (SEC-H5: nonce-based)
        ],
      },
      {
        // CORS for API routes
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: APP_ORIGIN },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization' },
        ],
      },
      {
        // Service Worker scope
        source: '/sw.js',
        headers: [
          { key: 'Service-Worker-Allowed', value: '/' },
          { key: 'Cache-Control', value: 'no-cache' },
        ],
      },
    ];
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  silent: true,
  tunnelRoute: '/monitoring',
  widenClientFileUpload: true,
  sourcemaps: {
    // Enable upload in CI: SENTRY_UPLOAD_SOURCEMAPS=true + SENTRY_AUTH_TOKEN + org/project
    disable: process.env.SENTRY_UPLOAD_SOURCEMAPS !== 'true',
  },
});
