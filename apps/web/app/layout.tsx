import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';
import { Providers } from '@/components/Providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ServiceSync SG - Smart Payment Collection',
  description: 'Smart payment collection for Singapore home service professionals. CRM, invoicing, booking, and PayNow QR — all in one app.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ServiceSync',
  },
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
  openGraph: {
    type: 'website',
    locale: 'en_SG',
    siteName: 'ServiceSync SG',
    title: 'ServiceSync SG — Business-in-a-Box for Home Service Pros',
    description: 'CRM, invoicing, booking, and PayNow QR collection — all in one mobile-first app built for Singapore technicians.',
    images: [{ url: '/icon.png', width: 512, height: 512, alt: 'ServiceSync SG' }],
  },
  twitter: {
    card: 'summary',
    title: 'ServiceSync SG',
    description: 'Smart payment collection for Singapore home service professionals.',
    images: ['/icon.png'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0ea5e9',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className="dark">
      <body className={`${inter.className} antialiased`}>
        <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Singapore">
          <Providers>
            {/* Dark gradient background with blue glow regions for glassmorphism */}
            <div className="fixed inset-0 -z-10 glass-bg-primary" />
            {/* Subtle noise texture for premium feel — CSS only, no external request */}
            <div className="fixed inset-0 -z-10 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%270 0 256 256%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.9%27 numOctaves=%274%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27/%3E%3C/svg%3E")' }} />
            {children}
          </Providers>

        </NextIntlClientProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
