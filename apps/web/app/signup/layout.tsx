import type { Metadata } from 'next';

const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://servicesync.sg';

export const metadata: Metadata = {
  title: 'Join the beta — ServiceSync SG',
  description:
    'Create your ServiceSync account and keep every dollar you earn. Zero commission, PayNow-ready, built for Singapore tradesmen.',
  alternates: { canonical: `${base}/signup` },
  openGraph: {
    title: 'Join the ServiceSync beta',
    description:
      'Zero commission. PayNow-ready. Built for Singapore tradesmen.',
    url: `${base}/signup`,
    type: 'website',
    locale: 'en_SG',
  },
  robots: { index: true, follow: true },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
