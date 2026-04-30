import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';
import { Providers } from '@/components/Providers';
import { BackgroundProvider } from '@/components/BackgroundProvider';

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
            <BackgroundProvider>
              {children}
            </BackgroundProvider>
          </Providers>

        </NextIntlClientProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
