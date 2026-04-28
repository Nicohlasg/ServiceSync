import Link from "next/link";

export const metadata = {
  title: "Terms of Service — ServiceSync",
  description: "Terms of Service for the ServiceSync platform.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-slate-300 px-4 py-16">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="text-sm text-blue-400 hover:text-blue-300 transition-colors mb-8 inline-block"
        >
          ← Back to Home
        </Link>

        <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Terms of Service</h1>
        <p className="text-slate-500 mb-10 text-sm">Last updated: 27 April 2026</p>

        <div className="space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Introduction</h2>
            <p>
              Welcome to ServiceSync (&quot;the Platform&quot;), operated by ServiceSync SG Pte Ltd
              (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;). These Terms of Service
              (&quot;Terms&quot;) govern your access to and use of the ServiceSync web application,
              mobile application, and related services (collectively, &quot;Services&quot;).
            </p>
            <p className="mt-3">
              By creating an account or using the Services, you agree to be bound by these Terms. If
              you do not agree, do not use the Services.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Eligibility</h2>
            <p>
              You must be at least 18 years of age and capable of entering into a legally binding
              agreement. By registering, you represent that you meet these requirements and that the
              information you provide is accurate and complete.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Account Registration</h2>
            <p>
              You are responsible for maintaining the confidentiality of your login credentials and
              for all activities under your account. You must notify us immediately of any
              unauthorised use. We reserve the right to suspend or terminate accounts that violate
              these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Service Provider Obligations</h2>
            <p>
              If you register as a service provider (technician), you agree to: (a) hold all
              licences and certifications required by Singapore law for your trade; (b) provide
              services in a professional, workmanlike manner; (c) accurately represent your
              qualifications, pricing, and availability; and (d) comply with all applicable laws and
              regulations including the Employment Act and Workplace Safety and Health Act.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Booking &amp; Payment</h2>
            <p>
              Bookings made through the Platform constitute a direct agreement between the customer
              and the service provider. ServiceSync facilitates communication and payment processing
              but is not a party to the service contract. Payments are processed via PayNow or cash
              collection, as selected at invoice creation.
            </p>
            <p className="mt-3">
              Deposits collected via PayNow are held in escrow by ServiceSync and released to the
              provider upon job completion confirmation. Refund disputes must be raised within 7
              calendar days of the service date.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Contact Import &amp; Third-Party Data</h2>
            <p>
              The Platform allows you to import contact information from your device&apos;s contact list
              or uploaded .vcf files. By using this feature, you represent and warrant that you have
              obtained all necessary consent from the individuals whose contact information you share
              with ServiceSync, in compliance with Singapore&apos;s Personal Data Protection Act (PDPA).
            </p>
            <p className="mt-3">
              You are solely responsible for ensuring that any third-party personal data you input into
              the Platform has been collected and shared lawfully.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Prohibited Conduct</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Use the Platform for any unlawful purpose</li>
              <li>Misrepresent your identity, qualifications, or business registration</li>
              <li>Interfere with or disrupt the Platform infrastructure</li>
              <li>Collect personal data of other users without consent</li>
              <li>Circumvent payment processing to avoid Platform fees</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. Intellectual Property</h2>
            <p>
              All content, trademarks, logos, and software on the Platform are the property of
              ServiceSync SG Pte Ltd or its licensors. You may not reproduce, distribute, or create
              derivative works without prior written consent.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by Singapore law, ServiceSync shall not be liable for
              any indirect, incidental, special, consequential, or punitive damages, including loss
              of profits, data, or business opportunities, arising from your use of the Services.
              Our total aggregate liability shall not exceed the fees paid by you in the 12 months
              preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. Termination</h2>
            <p>
              We may suspend or terminate your account at any time for violation of these Terms. You
              may delete your account at any time through the Profile settings. Upon termination, we
              will delete your personal data in accordance with our Privacy Policy, subject to legal
              retention obligations.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">11. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the Republic of Singapore. Any disputes shall
              be submitted to the exclusive jurisdiction of the Singapore courts. For claims below
              SGD 20,000, disputes shall first be referred to the Singapore Mediation Centre.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">12. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. Material changes will be notified via
              email or in-app notification. Continued use of the Services after changes constitutes
              acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">13. Contact</h2>
            <p>
              For questions about these Terms, contact us at{" "}
              <a href="mailto:support@servicesync.sg" className="text-blue-400 hover:underline">
                support@servicesync.sg
              </a>.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-800 text-xs text-slate-600 flex gap-4">
          <Link href="/privacy" className="hover:text-slate-400 transition-colors">
            Privacy Policy
          </Link>
          <Link href="/" className="hover:text-slate-400 transition-colors">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
