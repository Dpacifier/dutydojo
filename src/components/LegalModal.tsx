import { useState } from 'react';

type Tab = 'terms' | 'privacy' | 'data';

interface Props {
  initialTab?: Tab;
  onClose: () => void;
}

const COMPANY        = 'Switch IT Global Limited';
const COMPANY_NO     = '11001626';
const JURISDICTION   = 'England and Wales';
const PRODUCT        = 'DutyDojo';
const CONTACT_EMAIL  = 'legal@dutydojo.com';
const EFFECTIVE_DATE = '23 April 2026';

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
        (Company No. {COMPANY_NO}). {PRODUCT} is available as a desktop app for Windows and as
        a web app accessible from any browser. By installing or using {PRODUCT} you agree to
        these Terms &amp; Conditions in full. If you do not agree, you must not use the App.
      </Section>

      <Section title="2. Licence to Use">
        Subject to these Terms, {COMPANY} grants you a personal, non-transferable, non-exclusive,
        revocable licence to use {PRODUCT} on devices you own or control, solely for your
        personal, non-commercial household use. You must not sublicence, sell, rent, or otherwise
        distribute the App or any part of it.
      </Section>

      <Section title="3. Free and Paid Tiers">
        {PRODUCT} is offered on a freemium basis. A free tier is available with core
        functionality. Premium features may require a paid subscription. Subscription fees,
        billing periods, and included features are described at the point of purchase and on our
        website. Subscriptions renew automatically unless cancelled before the renewal date.
        Refunds are handled in accordance with our refund policy, available on request.
      </Section>

      <Section title="4. Acceptable Use">
        You agree to use {PRODUCT} only for lawful purposes and in a manner that does not infringe
        the rights of any third party. You must not: (a) attempt to decompile, reverse engineer,
        or extract source code from the App; (b) use the App to store or transmit unlawful,
        defamatory, or harmful content; (c) attempt to gain unauthorised access to any part of
        our systems; (d) use the App for any commercial purpose without our prior written consent.
      </Section>

      <Section title="5. Intellectual Property">
        All intellectual property rights in {PRODUCT} — including its design, code, branding, and
        content — are owned by or licensed to {COMPANY}. Nothing in these Terms transfers any IP
        rights to you. The {PRODUCT} name and logo are trademarks of {COMPANY}.
      </Section>

      <Section title="6. Data Ownership">
        All content you create within {PRODUCT} — children's profiles, behaviour records, reward
        data, and history — belongs to you. {COMPANY} does not claim any ownership of your data.
        See our Privacy Policy and Data &amp; GDPR sections for how your data is stored and
        processed.
      </Section>

      <Section title="7. Disclaimer of Warranties">
        The App is provided "as is" and "as available" without warranties of any kind, express or
        implied. We do not warrant that the App will be uninterrupted, error-free, or free of
        harmful components.
      </Section>

      <Section title="8. Limitation of Liability">
        To the fullest extent permitted by law, {COMPANY} shall not be liable for any indirect,
        incidental, special, consequential, or punitive damages arising from your use of or
        inability to use {PRODUCT}. Our total aggregate liability to you shall not exceed the
        greater of (a) the amounts paid by you to us in the 12 months preceding the claim, or
        (b) £100. Nothing in these Terms limits liability for death or personal injury caused by
        our negligence, fraud, or any other liability that cannot be excluded by law.
      </Section>

      <Section title="9. Changes to the App and Terms">
        We may update {PRODUCT} and these Terms at any time. Material changes will be notified
        within the App or by email (if provided). Continued use after notification constitutes
        acceptance of the revised Terms.
      </Section>

      <Section title="10. Termination">
        We may suspend or terminate your access to {PRODUCT} if you breach these Terms. You may
        stop using the App at any time. Upon termination, the licence granted to you ceases
        immediately. You may request deletion of your account and data at any time — see the
        Data &amp; GDPR section for details.
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
        We are the data controller for the personal data you provide when creating an account.
        For questions about this policy contact us at{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className="underline text-dojo-primary">{CONTACT_EMAIL}</a>.
      </Section>

      <Section title="2. What Data We Process">
        {PRODUCT} processes the following categories of personal data:
        <ul className="list-disc pl-5 mt-1 space-y-1">
          <li><strong>Account details</strong> — your email address and a securely hashed password, used to sign in</li>
          <li><strong>Children's profiles</strong> — first names (or nicknames), avatar emoji, point balances, and behaviour history that you enter</li>
          <li><strong>Household settings</strong> — reward definitions, behaviour categories, and parental preferences you configure</li>
          <li><strong>Activity records</strong> — points earned or deducted, rewards claimed, and timestamps of activity</li>
          <li><strong>Notification email</strong> — an email address you optionally provide to receive weekly digests or approval alerts</li>
        </ul>
        We do <strong>not</strong> collect addresses, phone numbers, school details, photos,
        location data, payment card numbers, or any other sensitive personal data.
      </Section>

      <Section title="3. How Your Data Is Stored">
        <strong>Web app users:</strong> Your account and all family data are stored securely in
        {COMPANY}'s cloud infrastructure, hosted in the EU. Your data is protected so that only
        your account can access it.
        <br /><br />
        <strong>Desktop app users:</strong> By default, all data is stored <strong>on your
        device only</strong> and is never sent to us. If you choose to enable <strong>Cloud
        Sync</strong>, your data is also stored in {COMPANY}'s secure cloud so you can access
        it across devices. Cloud Sync is entirely optional and can be disabled at any time.
      </Section>

      <Section title="4. Why We Process Your Data (Legal Basis)">
        We process personal data on the following legal bases:
        <ul className="list-disc pl-5 mt-1 space-y-1">
          <li><strong>Contract performance</strong> — to provide the service you signed up for, including storing and syncing your family data</li>
          <li><strong>Legitimate interests</strong> — to keep the service secure, fix bugs, and improve the app</li>
          <li><strong>Consent</strong> — for optional features such as email notifications, which you can turn off at any time in Settings</li>
        </ul>
      </Section>

      <Section title="5. Data Sharing">
        {COMPANY} does <strong>not</strong> sell, rent, or share your personal data with third
        parties for marketing purposes. Data may be shared only with:
        <ul className="list-disc pl-5 mt-1 space-y-1">
          <li><strong>Supabase</strong> — our cloud database and authentication provider, used to store and secure your account and family data. Supabase is GDPR-compliant and data is hosted in the EU</li>
          <li><strong>Resend</strong> — our email delivery service, used only to send notifications you have opted in to (weekly digest, approval alerts). Only your chosen notification email address is shared</li>
          <li><strong>Law enforcement</strong> — where required by applicable law</li>
        </ul>
      </Section>

      <Section title="6. Data Retention">
        We retain your data for as long as your account is active. You can delete your account at
        any time — web app users can do this via Settings → Danger Zone; desktop app users can
        contact us at{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className="underline text-dojo-primary">{CONTACT_EMAIL}</a>.
        Deleting your account permanently removes all your data from our systems within 30 days.
        You can also export your data at any time via the History tab or Settings → Backup.
      </Section>

      <Section title="7. Your Rights">
        Under UK GDPR and the Data Protection Act 2018 you have the right to:
        <ul className="list-disc pl-5 mt-1 space-y-1">
          <li>Access the personal data we hold about you</li>
          <li>Correct inaccurate data</li>
          <li>Erase your data ("right to be forgotten")</li>
          <li>Restrict or object to processing</li>
          <li>Receive your data in a portable format (export via Settings)</li>
          <li>Lodge a complaint with the <strong>Information Commissioner's Office (ICO)</strong> at ico.org.uk</li>
        </ul>
        To exercise any right, email{' '}
        <a href={`mailto:${CONTACT_EMAIL}`} className="underline text-dojo-primary">{CONTACT_EMAIL}</a>.
        We will respond within 30 days.
      </Section>

      <Section title="8. Children's Privacy">
        {PRODUCT} is designed to be used by parents and guardians. The App is{' '}
        <strong>not directed at children</strong> — children should not create accounts or
        configure the App independently. As the parent or guardian, you are responsible for
        the data you enter about your children and for using the App in a way that respects
        their wellbeing and complies with applicable law.
      </Section>

      <Section title="9. Security">
        We use industry-standard security measures including encrypted data transmission (HTTPS),
        secure password hashing, and row-level access controls so that only your account can
        access your data. No system is entirely risk-free; in the event of a data breach that
        affects your rights, we will notify you as required by law.
      </Section>

      <Section title="10. Changes to This Policy">
        We may update this Privacy Policy from time to time. Changes will be communicated via an
        in-app notice or email. Continued use of the App constitutes acceptance of the updated
        policy.
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
      <Section title="1. How DutyDojo Stores Your Data">
        {PRODUCT} is available as a <strong>Windows desktop app</strong> and a{' '}
        <strong>web app</strong> (accessible from any browser or installable on your phone).
        <br /><br />
        <strong>Web app:</strong> All data is stored in {COMPANY}'s secure cloud, hosted in the
        EU. You sign in with your email address and password — no technical setup required.
        <br /><br />
        <strong>Desktop app:</strong> Data is stored locally on your computer by default.
        You can optionally enable <strong>Cloud Sync</strong> in Settings to back up your data
        to {COMPANY}'s cloud and access it across multiple devices.
      </Section>

      <Section title="2. Who Controls Your Data">
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>You (the parent or guardian)</strong> are the <em>data controller</em> for
            all personal data you enter — your children's names, behaviour logs, and point
            history. You decide what is recorded and how long it is kept.
          </li>
          <li>
            <strong>{COMPANY}</strong> acts as a <em>data processor</em> on your behalf. We store
            and secure your data using our cloud infrastructure but we do not use your family data
            for any other purpose.
          </li>
          <li>
            <strong>Supabase</strong> is our cloud database provider and acts as a sub-processor.
            Supabase is GDPR-compliant; their data processing agreement is available at{' '}
            <strong>supabase.com/privacy</strong>. Data is hosted in the EU.
          </li>
        </ul>
      </Section>

      <Section title="3. What Data Is Stored">
        The following information may be stored, depending on how you use the app:
        <ul className="list-disc pl-5 mt-1 space-y-1">
          <li><strong>Children</strong> — name, avatar, goal points, consequence threshold, theme colour, notes</li>
          <li><strong>Behaviours</strong> — name, kind (positive/negative), points value, icon, daily limit, category</li>
          <li><strong>Rewards</strong> — name, cost, icon</li>
          <li><strong>Consequences</strong> — name, icon, description; and any assigned consequence records</li>
          <li><strong>History</strong> — point transactions with timestamps, reasons, and fulfilment status</li>
          <li><strong>Settings</strong> — parental preferences (approval mode, point caps, defaults)</li>
          <li><strong>Account</strong> — email address, hashed password, notification preferences</li>
        </ul>
        We recommend using first names or nicknames rather than full names, and not entering
        sensitive information beyond what the reward system needs.
      </Section>

      <Section title="4. Cloud Sync & Data Transfer">
        When Cloud Sync is enabled (desktop) or when using the web app:
        <ul className="list-disc pl-5 mt-1 space-y-1">
          <li>Data is transmitted over HTTPS to {COMPANY}'s managed cloud database</li>
          <li>Access controls ensure only your signed-in account can read or write your data</li>
          <li>Infrastructure is hosted within the EU (London region)</li>
          <li>You can export or delete all your data at any time — see section 6 below</li>
        </ul>
        <strong>You do not need to set up any external service or account</strong> to use cloud
        features — {COMPANY} manages the infrastructure on your behalf.
      </Section>

      <Section title="5. Email Notifications">
        Email notifications (weekly family digest, approval alerts) are <strong>entirely
        optional</strong>. To enable them, simply enter your preferred email address in
        Settings → Email notifications. No technical setup is required.
        <ul className="list-disc pl-5 mt-1 space-y-1">
          <li>Notification emails are sent by {COMPANY} on your behalf using our email delivery service</li>
          <li>Only the email address you provide is used; it is not shared with any other party</li>
          <li>You can turn off notifications at any time in Settings</li>
        </ul>
      </Section>

      <Section title="6. Exporting and Deleting Your Data">
        You have full control over your data at all times:
        <ul className="list-disc pl-5 mt-1 space-y-1">
          <li><strong>Export history</strong> — available in the History tab for individual children or all children combined</li>
          <li><strong>Desktop backup</strong> — Settings → Backup &amp; Restore creates a full local backup file</li>
          <li><strong>Delete account (web app)</strong> — Settings → Danger Zone permanently deletes your account and all associated data immediately</li>
          <li><strong>Delete account (desktop)</strong> — email{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="underline text-dojo-primary">{CONTACT_EMAIL}</a>{' '}
            and we will erase your cloud data within 30 days</li>
          <li><strong>Uninstalling the desktop app</strong> removes the local database from your device</li>
        </ul>
      </Section>

      <Section title="7. Children's Data (UK GDPR / COPPA)">
        {PRODUCT} processes children's personal data (names and behavioural records) solely on
        the instructions of the parent or guardian who creates the account. As the adult user
        you are responsible for:
        <ul className="list-disc pl-5 mt-1 space-y-1">
          <li>Ensuring you have appropriate authority to process your children's data</li>
          <li>Using the App in a manner that respects your children's dignity and wellbeing</li>
          <li>Deciding how long to retain historical behaviour records</li>
        </ul>
      </Section>

      <Section title="8. Data Breach Notification">
        In the event of a security incident that poses a risk to your rights and freedoms, we
        will notify you via the App or by email within 72 hours of becoming aware of the breach,
        as required by UK GDPR Article 33.
      </Section>

      <Section title="9. ICO Registration & Complaints">
        {COMPANY} is registered with the Information Commissioner's Office (ICO) as required
        under UK data protection law. If you have a complaint about how we handle personal data,
        you may contact the ICO at <strong>ico.org.uk</strong> or by post at Wycliffe House,
        Water Lane, Wilmslow, Cheshire, SK9 5AF.
      </Section>

      <Section title="10. Contact">
        For any data protection enquiry, subject access request, or erasure request:<br />
        <strong>{COMPANY}</strong> · Company No. {COMPANY_NO} · Registered in {JURISDICTION}<br />
        Email: <a href={`mailto:${CONTACT_EMAIL}`} className="underline text-dojo-primary">{CONTACT_EMAIL}</a>
      </Section>
    </>
  );
}

/* ──────────────────────────────────────────────────────────── */
/*  Shared section component                                    */
/* ──────────────────────────────────────────────────────────── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-semibold text-dojo-ink dark:text-slate-100 mb-1">{title}</h3>
      <div className="text-dojo-muted dark:text-slate-300 leading-relaxed">{children}</div>
    </div>
  );
}