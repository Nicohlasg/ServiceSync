import type { Metadata } from 'next';

const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://servicesync.sg';

export const metadata: Metadata = {
  title: 'Log in — ServiceSync SG',
  description: 'Log in to ServiceSync SG to manage your jobs, invoices, and payments.',
  alternates: { canonical: `${base}/login` },
  robots: { index: false, follow: true },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
