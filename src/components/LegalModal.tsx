import { useState } from 'react';

type Tab = 'terms' | 'privacy' | 'data';

interface Props {
  initialTab?: Tab;
  onClose: () => void;
}

const COMPANY = 'Switch IT Global Limited';
const COMPANY_NO = '11001626';
const JURISDICTION = 'England and Wales';
const PRODUCT = 'DutyDojo';
const CONTACT_EMAIL = 'legal@switchitglobal.com';
const EFFECTIVE_DATE = '1 May 2025';

const TABS: { id: Tab; label: string }[] = [
  { id: 'terms',   label: '📋 Terms & Conditions' },
  { id: 'privacy', label: '🔒 Privacy Policy' },
  { id: 'data',    label: '🛡️ Data & GDPR' },
];

export function LegalModal({ initialTab = 'terms', onClose }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100 dark:border-slate-700 shrink-0">
          <div>
            <div className="font-display font-bold text-lg">{PRODUCT} — Legal</div>
            <div className="text-xs text-dojo-muted">Effective {EFFECTIVE_DATE} · {COMPANY}</div>
          </div>
          <button
            onClick={onClose}
            className="text-dojo-muted hover:text-dojo-ink dark:hover:text-slate-100 text-2xl leading-none transition"
            aria-label="Close"
          >×</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-3 shrink-0">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition ${
                tab === t.id
                  ? 'bg-dojo-primary text-white'
                  : 'text-dojo-muted hover:text-dojo-ink dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-6 py-4 text-sm leading-relaxed text-dojo-ink dark:text-slate-200 space-y-4 flex-1">
          {tab === 'terms'   && <TermsContent />}
          {tab === 'privacy' && <PrivacyContent />}
          {tab === 'data'    && <DataContent />}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-700 text-xs text-dojo-muted shrink-0 flex justify-between items-center">
          <span>Questions? <a href={`mailto:${CONTACT_EMAIL}`} className="underline hover:text-dojo-primary">{CONTACT_EMAIL}</a></span>
          <button onClick={onClose} className="dojo-btn-primary text-xs py-1.5 px-4">Close</button>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  Terms & Conditions                                        */
/* ────────────────────────────────────────────────────────── */
function TermsContent() {
  return (
    <>
      <Section title="1. About DutyDojo">
        {PRODUCT} ("the App") is a family behaviour-tracking and reward-management application
        published by <strong>{COMPANY}</strong>, a company registered in {JURISDICTION}
        (Company No. {COMPANY_NO}). By downloading, installing, or using {PRODUCT} you agree to
        these Terms &amp; Conditions in full. If you do not agree, you must not use the App.
      </Section>

      <Section title="2. Licence to Use">
        Subject to these Terms, {COMPANY} grants you a personal, non-transferable, non-exclusive,
        revocable licence to install and use {PRODUCT} on devices you own or control, solely for
        your personal, non-commercial household use. You must not sublicence, sell, rent, or
        otherwise distribute the App or any part of it.
      </Section>

      <Section title="3. Free and Paid Tiers">
        {PRODUCT} is offered on a freemium basis. A free tier is available with core functionality.
        Premium features may require a paid subscription. Subscription fees, billing periods, and
        included features are described at the point of purchase and on our website. All fees are
        stated inclusive or exclusive of VAT as required by applicable law. Subscriptions renew
        automatically unless cancelled before the renewal date. Refunds are handled in accordance
        with the relevant app store policy or, for direct purchases, our refund policy available
        on request.
      </Section>

      <Section title="4. Acceptable Use">
        You agree to use {PRODUCT} only for lawful purposes and in a manner that does not infringe
        the rights of any third party. You must not: (a) attempt to decompile, reverse engineer, or
        extract source code from the App; (b) use the App to store or transmit unlawful, defamatory,
        or harmful content; (c) attempt to gain unauthorised access to any part of our systems;
        (d) use the App for any commercial purpose without our prior written consent.
      </Section>

      <Section title="5. Intellectual Property">
        All intellectual property rights in {PRODUCT} — including its design, code, branding, and
        content — are owned by or licensed to {COMPANY}. Nothing in these Terms transfers any IP
        rights to you. The {PRODUCT} name and logo are trademarks of {COMPANY}.
      </Section>

      <Section title="6. Data Ownership">
        All content you create within {PRODUCT} (children's profiles, behaviour records, reward
        data, and history) belongs to you. {COMPANY} does not claim any ownership of your data.
        See our Privacy Policy and Data &amp; GDPR sections for how your data is stored and
        processed.
      </Section>

      <Section title="7. Disclaimer of Warranties">
        The App is provided "as is" and "as available" without warranties of any kind, express or
        implied, including warranties of merchantability, fitness for a particular purpose, or
        non-infringement. We do not warrant that the App will be uninterrupted, error-free, or
        free of harmful components.
      </Section>

      <Section title="8. Limitation of Liability">
        To the fullest extent permitted by law, {COMPANY} shall not be liable for any indirect,
        incidental, special, consequential, or punitive damages, or loss of data, arising from
        your use of or inability to use {PRODUCT}. Our total aggregate liability to you shall not
        exceed the greater of (a) the amounts paid by you to us in the 12 months preceding the
        claim, or (b) £100. Nothing in these Terms limits liability for death or personal injury
        caused by our negligence, fraud, or any other liability that cannot be excluded by law.
      </Section>

      <Section title="9. Changes to the App and Terms">
        We may update {PRODUCT} and these Terms at any time. Material changes will be notified
        within the App or by email (if provided). Continued use after notification constitutes
        acceptance of the revised Terms.
      </Section>

      <Section title="10. Termination">
        We may suspend or terminate your access to {PRODUCT} if you breach these Terms. You may
        stop using the App at any time by uninstalling it. Upon termination, the licence granted
        to you ceases immediately; provisions that by their nature should survive termination will
        do so.
      </Section>

      <Section title="11. Governing Law and Disputes">
        These Terms are governed by the laws of {JURISDICTION}. Any dispute arising from or in
        connection with these Terms shall be subject to the exclusive jurisdiction of the courts
        of {JURISDICTION}. If you are a consumer, you may also have rights under the law of your
        country of residence.
      </Section>

      <Section title="12. Contact">
        {COMPANY} · Registered in {JURISDICTION} · Company No. {COMPANY_NO}<br />
        Email: <a href={`mailto:${CONTACT_EMAIL}`} className="underline text-dojo-primary">{CONTACT_EMAIL}</a>
      </Section>
    </>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  Privacy Policy                                            */
/* ────────────────────────────────────────────────────────── */
function PrivacyContent() {
  return (
    <>
      <Section title="1. Who We Are">
        {COMPANY} (Company No. {COMPANY_NO}), registered in {JURISDICTION}, publishes {PRODUCT}.
        We are the software publisher. For questions about this policy contact us at{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className="underline text-dojo-primary">{CONTACT_EMAIL}</a>.
      </Section>

      <Section title="2. What Data the App Processes">
        {PRODUCT} processes the following categories of personal data on your device:
        <ul className="list-disc pl-5 mt-1 space-y-1">
          <li><strong>Children's profiles</strong> — names, avatar emoji, point balances, and behaviour history</li>
          <li><strong>Household settings</strong> — reward definitions, behaviour categories, parental preferences</li>
          <li><strong>Usage data</strong> — points earned/deducted, rewards claimed, timestamps of activity</li>
          <li><strong>Account credentials</strong> (cloud sync only) — your email address and a hashed password, stored securely in your own Supabase project</li>
        </ul>
        We do <strong>not</strong> collect names, addresses, school details, photos, location data,
        or any sensitive personal data beyond the above.
      </Section>

      <Section title="3. How Your Data Is Stored">
        By default, all data is stored <strong>exclusively on your device</strong> in an encrypted
        SQLite database. {COMPANY} has no access to this local data.
        <br /><br />
        If you choose to enable <strong>Cloud Sync</strong>, your data is replicated to a Supabase
        database project that <strong>you create and control</strong>. {COMPANY} does not own,
        operate, or have access to your Supabase project. Row-Level Security (RLS) ensures only
        your authenticated account can read or write your data.
      </Section>

      <Section title="4. Legal Basis for Processing (UK GDPR)">
        We process personal data on the following legal bases:
        <ul className="list-disc pl-5 mt-1 space-y-1">
          <li><strong>Legitimate interests</strong> — operating the app and providing its core functionality</li>
          <li><strong>Contract performance</strong> — delivering paid subscription features you have purchased</li>
          <li><strong>Consent</strong> — for optional features such as email notifications via Resend</li>
        </ul>
        As the parent or guardian using this App, you are the <strong>data controller</strong>
        for your children's personal data. {COMPANY} acts as a software provider and does not
        independently control or process that data.
      </Section>

      <Section title="5. Data Sharing">
        {COMPANY} does <strong>not</strong> sell, rent, or share your personal data with third
        parties for marketing purposes. Data is not shared with any third party except:
        <ul className="list-disc pl-5 mt-1 space-y-1">
          <li><strong>Supabase</strong> — only if you enable Cloud Sync, and only within your own project</li>
          <li><strong>Resend</strong> — only if you configure email notifications and provide your own Resend API key; emails are sent from your own Resend account</li>
          <li><strong>App store providers</strong> (Apple, Microsoft) — purchase and download records per their own privacy policies</li>
          <li><strong>Law enforcement</strong> — where required by law</li>
        </ul>
      </Section>

      <Section title="6. Data Retention">
        Your data is retained on your device until you uninstall the App or delete individual
        records. If you use Cloud Sync, data remains in your Supabase project until you delete
        it there. You can export or delete all your data at any time via the Backup &amp; Restore
        feature in Settings.
      </Section>

      <Section title="7. Your Rights">
        Under UK GDPR and the Data Protection Act 2018 you have the right to:
        <ul className="list-disc pl-5 mt-1 space-y-1">
          <li>Access the personal data held about you</li>
          <li>Rectify inaccurate data</li>
          <li>Erase your data ("right to be forgotten")</li>
          <li>Restrict processing</li>
          <li>Data portability (export via Settings → Backup)</li>
          <li>Object to processing</li>
          <li>Lodge a complaint with the <strong>Information Commissioner's Office (ICO)</strong> at ico.org.uk</li>
        </ul>
        To exercise any right, email us at{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className="underline text-dojo-primary">{CONTACT_EMAIL}</a>.
        We will respond within 30 days.
      </Section>

      <Section title="8. Children's Privacy">
        {PRODUCT} is designed to be used by parents and guardians to manage their own children's
        data. The App is <strong>not directed at children</strong> and children should not create
        accounts or configure the App independently. If you are a parent using the App, you are
        responsible for ensuring that your use of the App complies with applicable laws regarding
        the processing of children's personal data in your jurisdiction.
      </Section>

      <Section title="9. Security">
        We implement appropriate technical and organisational measures to protect personal data,
        including local database protection, secure session token storage, and encrypted
        transmission to Supabase over HTTPS. No system is completely secure; in the event of a
        data breach affecting your rights, we will notify you as required by law.
      </Section>

      <Section title="10. Changes to This Policy">
        We may update this Privacy Policy from time to time. Changes will be communicated via an
        in-app notice or the next application update. Continued use of the App constitutes
        acceptance of the updated policy.
      </Section>
    </>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  Data & GDPR                                               */
/* ────────────────────────────────────────────────────────── */
function DataContent() {
  return (
    <>
      <Section title="1. Data Architecture Overview">
        {PRODUCT} is an <strong>offline-first desktop application</strong>. Your data stays on
        your device by default and is never transmitted to {COMPANY}'s servers at any point.
        The optional Cloud Sync feature replicates data to a Supabase project that you own —
        {COMPANY} has no access to this project.
      </Section>

      <Section title="2. Data Controller vs. Data Processor">
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>You (the parent/guardian)</strong> are the <em>data controller</em> for all
            personal data entered into the App, including your children's names, behaviour logs,
            and point history.
          </li>
          <li>
            <strong>{COMPANY}</strong> is the <em>software publisher</em> and does not independently
            store or process your personal data. We do not have access to your local database or
            your Supabase project.
          </li>
          <li>
            <strong>Supabase</strong> (if you enable Cloud Sync) acts as a sub-processor under
            your control. Supabase is GDPR-compliant and its Data Processing Agreement is available
            at supabase.com/privacy.
          </li>
        </ul>
      </Section>

      <Section title="3. What Data Is Stored Locally">
        The following tables are stored in an SQLite database on your device:
        <ul className="list-disc pl-5 mt-1 space-y-1">
          <li><strong>children</strong> — name, avatar, goal points, consequence threshold, theme colour, notes</li>
          <li><strong>behaviours</strong> — name, kind, points value, icon, daily limit, category</li>
          <li><strong>rewards</strong> — name, cost, icon</li>
          <li><strong>consequences</strong> — name, icon, description; and assigned consequence records</li>
          <li><strong>history</strong> — point transactions with timestamps, reasons, and fulfilment status</li>
          <li><strong>settings</strong> — parental preferences (approval mode, caps, defaults)</li>
          <li><strong>cloud_config</strong> — session tokens for Cloud Sync (stored locally, never sent to us)</li>
        </ul>
      </Section>

      <Section title="4. Cloud Sync & Data Transfer">
        Cloud Sync is <strong>entirely optional</strong>. When enabled:
        <ul className="list-disc pl-5 mt-1 space-y-1">
          <li>Data is transmitted over HTTPS to your Supabase project</li>
          <li>All rows are protected by Row-Level Security: only your authenticated user ID can read or write them</li>
          <li>Supabase infrastructure may be hosted within the EU or US depending on the region you select when creating your project. We recommend selecting a UK/EU region for GDPR compliance</li>
          <li>You can disable Cloud Sync and delete your Supabase data at any time</li>
        </ul>
      </Section>

      <Section title="5. Email Notifications & Resend">
        Email notifications (weekly digest, approval alerts) are <strong>entirely optional</strong>
        and require you to provide your own <strong>Resend API key</strong>. When configured:
        <ul className="list-disc pl-5 mt-1 space-y-1">
          <li>Emails are sent directly from your Resend account to the address you specify</li>
          <li>{COMPANY} does not handle or see the contents of these emails</li>
          <li>Your Resend API key is stored only in your local database and Supabase project</li>
          <li>You can disable notifications at any time in Settings → Cloud Sync</li>
        </ul>
      </Section>

      <Section title="6. Data Portability & Deletion">
        You have full control over your data:
        <ul className="list-disc pl-5 mt-1 space-y-1">
          <li><strong>Export</strong> — Settings → Backup &amp; Restore → Export Backup creates a full database backup file</li>
          <li><strong>History CSV export</strong> — available in the History tab for individual children or all children</li>
          <li><strong>Deletion</strong> — uninstalling the App removes the local database. To remove cloud data, delete your Supabase project or the relevant tables</li>
        </ul>
      </Section>

      <Section title="7. Children's Data (UK GDPR Article 8 / COPPA)">
        {PRODUCT} processes children's personal data (names and behavioural records) on behalf
        of the parent or guardian who installs and controls the App. As the adult user you are
        responsible for:
        <ul className="list-disc pl-5 mt-1 space-y-1">
          <li>Ensuring you have appropriate authority to process your children's data</li>
          <li>Using the App in a manner that respects your children's dignity and wellbeing</li>
          <li>Deciding whether and how long to retain historical behaviour records</li>
        </ul>
        {COMPANY} recommends using first names or nicknames rather than full names, and not
        entering sensitive information beyond what is needed for the App's reward functionality.
      </Section>

      <Section title="8. Data Breach Notification">
        In the event of a security incident that affects your personal data and poses a risk to
        your rights and freedoms, we will notify you via the App or by email (if provided) within
        72 hours of becoming aware of the breach, as required by UK GDPR Article 33.
      </Section>

      <Section title="9. ICO Registration & Complaints">
        {COMPANY} is registered with the Information Commissioner's Office (ICO) as required
        under UK data protection law. If you have a complaint about how we handle personal data,
        you may contact the ICO at <strong>ico.org.uk</strong> or by post at Wycliffe House,
        Water Lane, Wilmslow, Cheshire, SK9 5AF.
      </Section>

      <Section title="10. Contact Our Data Lead">
        For any data protection enquiry, subject access request, or erasure request:<br />
        <strong>{COMPANY}</strong> · Company No. {COMPANY_NO} · Registered in {JURISDICTION}<br />
        Email: <a href={`mailto:${CONTACT_EMAIL}`} className="underline text-dojo-primary">{CONTACT_EMAIL}</a>
      </Section>
    </>
  );
}

/* ────────────────────────────────────────────────────────── */
/*  Shared section component                                  */
/* ────────────────────────────────────────────────────────── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-semibold text-dojo-ink dark:text-slate-100 mb-1">{title}</h3>
      <div className="text-dojo-muted dark:text-slate-300 leading-relaxed">{children}</div>
    </div>
  );
}
