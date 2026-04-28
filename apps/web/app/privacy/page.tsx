import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — ServiceSync",
  description: "Privacy Policy for the ServiceSync platform, compliant with the Singapore PDPA.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-slate-300 px-4 py-16">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="text-sm text-blue-400 hover:text-blue-300 transition-colors mb-8 inline-block"
        >
          ← Back to Home
        </Link>

        <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Privacy Policy</h1>
        <p className="text-slate-500 mb-10 text-sm">Last updated: 27 April 2026</p>

        <div className="space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Introduction</h2>
            <p>
              ServiceSync SG Pte Ltd (&quot;ServiceSync&quot;, &quot;we&quot;, &quot;us&quot;, or
              &quot;our&quot;) is committed to protecting your personal data in accordance with the
              Personal Data Protection Act 2012 (&quot;PDPA&quot;) of Singapore.
            </p>
            <p className="mt-3">
              This Privacy Policy explains what personal data we collect, how we use and protect it,
              and your rights as a data subject.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Data We Collect</h2>
            <p>We collect the following categories of personal data:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>
                <span className="text-white font-medium">Account data:</span> Name, email address,
                phone number, password (hashed)
              </li>
              <li>
                <span className="text-white font-medium">Business data:</span> ACRA UEN, trade
                category, service areas, PayNow key
              </li>
              <li>
                <span className="text-white font-medium">Booking data:</span> Customer name, phone,
                address, service date, job descriptions
              </li>
              <li>
                <span className="text-white font-medium">Payment data:</span> Invoice amounts,
                payment status, PayNow reference numbers, digital signatures
              </li>
              <li>
                <span className="text-white font-medium">Technical data:</span> IP address, browser
                type, device information, access logs
              </li>
              <li>
                <span className="text-white font-medium">Contact data:</span> If you choose to import
                contacts, we access names and phone numbers from your device&apos;s contact list or
                uploaded .vcf files. This data is only used to create client records in your account.
              </li>
              <li>
                <span className="text-white font-medium">Location data:</span> We use your
                device&apos;s location (with your permission) to estimate travel times and provide
                address autocomplete via OneMap SG.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. How We Use Your Data</h2>
            <p>We use your personal data for the following purposes:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>To create and manage your account</li>
              <li>To facilitate bookings between customers and service providers</li>
              <li>To process payments and issue invoices</li>
              <li>To send transactional notifications (booking confirmations, payment receipts)</li>
              <li>To verify business registration via ACRA</li>
              <li>To improve our Services and fix technical issues</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Legal Basis (PDPA Consent)</h2>
            <p>
              By creating an account, you consent to the collection, use, and disclosure of your
              personal data as described in this Policy. You may withdraw consent at any time by
              deleting your account, though this may affect your ability to use the Services.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Data Sharing</h2>
            <p>
              We do not sell your personal data. We share data only with:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>
                <span className="text-white font-medium">Service providers:</span> Customer contact
                details are shared with the technician assigned to a booking
              </li>
              <li>
                <span className="text-white font-medium">Payment processors:</span> PayNow
                (processed through DBS/OCBC/UOB banking rails)
              </li>
              <li>
                <span className="text-white font-medium">Infrastructure partners:</span> Supabase
                (database hosting), Vercel (application hosting) — all data stored in Singapore or
                APAC regions
              </li>
              <li>
                <span className="text-white font-medium">Legal authorities:</span> When required by
                Singapore law or court order
              </li>
              <li>
                <span className="text-white font-medium">OneMap SG:</span> Address lookups are
                processed through Singapore&apos;s OneMap service (onemap.gov.sg). No personal data is
                sent — only the search query text.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Data Retention</h2>
            <p>
              We retain your personal data for as long as your account is active. After account
              deletion:
            </p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Personal profile data is deleted within 30 days</li>
              <li>
                Invoice and payment records are retained for 5 years as required by the Income Tax
                Act and GST regulations
              </li>
              <li>
                Anonymised usage data may be retained indefinitely for analytics
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Data Security</h2>
            <p>
              We implement industry-standard security measures including: encryption in transit
              (TLS 1.3), encryption at rest (AES-256), Row Level Security (RLS) policies on all
              database tables, secure cookie-based authentication, and Content Security Policy
              headers. Access to production systems is restricted to authorised personnel only.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Your Rights Under PDPA</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>
                <span className="text-white font-medium">Access:</span> Request a copy of the
                personal data we hold about you
              </li>
              <li>
                <span className="text-white font-medium">Correction:</span> Update or correct
                inaccurate personal data via your Profile page
              </li>
              <li>
                <span className="text-white font-medium">Withdrawal of consent:</span> Delete your
                account and associated data at any time
              </li>
              <li>
                <span className="text-white font-medium">Data portability:</span> Request your data
                in a machine-readable format
              </li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, contact our Data Protection Officer at{" "}
              <a href="mailto:dpo@servicesync.sg" className="text-blue-400 hover:underline">
                dpo@servicesync.sg
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Cookies</h2>
            <p>
              We use strictly necessary cookies for authentication and session management. We do not
              use tracking cookies or third-party advertising cookies. No cookie consent is required
              for strictly necessary cookies under PDPA, but we provide transparency here.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. International Transfers</h2>
            <p>
              Your data is primarily stored and processed in Singapore. Where data is processed
              outside Singapore (e.g., by infrastructure partners), we ensure adequate protection
              through contractual safeguards compliant with the PDPA Transfer Limitation Obligation.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">11. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Material changes will be notified
              via email or in-app notification at least 14 days before taking effect.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">12. Contact &amp; DPO</h2>
            <p>
              For privacy-related inquiries or complaints, contact our Data Protection Officer:
            </p>
            <p className="mt-2">
              Email:{" "}
              <a href="mailto:dpo@servicesync.sg" className="text-blue-400 hover:underline">
                dpo@servicesync.sg
              </a>
            </p>
            <p className="mt-3 text-xs text-slate-500">
              If you are not satisfied with our response, you may lodge a complaint with the Personal
              Data Protection Commission (PDPC) at{" "}
              <a
                href="https://www.pdpc.gov.sg"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                www.pdpc.gov.sg
              </a>.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-800 text-xs text-slate-600 flex gap-4">
          <Link href="/terms" className="hover:text-slate-400 transition-colors">
            Terms of Service
          </Link>
          <Link href="/" className="hover:text-slate-400 transition-colors">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
