import { useEffect, useState } from 'react';

interface CloudStatus {
  configured: boolean;
  connected: boolean;
  email: string;
  lastSync: string;
  resendKey: boolean;
  notifEmail: string;
  weeklyDigest: boolean;
  approvalAlerts: boolean;
}

function timeAgo(iso: string): string {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function CloudSyncSettings() {
  const [status, setStatus]     = useState<CloudStatus | null>(null);
  const [loading, setLoading]   = useState(true);

  // Auth form
  const [authMode, setAuthMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail]       = useState('');
  const [password, setPw]       = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authMsg, setAuthMsg]   = useState('');

  // Email config form
  const [resendKey, setResendKey]   = useState('');
  const [notifEmail, setNotifEmail] = useState('');
  const [weeklyDigest, setWeekly]   = useState(false);
  const [approvalAlerts, setAlerts] = useState(false);
  const [emailBusy, setEmailBusy]   = useState(false);
  const [emailMsg, setEmailMsg]     = useState('');

  // Sync status
  const [syncing, setSyncing]   = useState(false);
  const [syncMsg, setSyncMsg]   = useState('');

  async function load() {
    setLoading(true);
    const s: CloudStatus = await window.dojo.cloudStatus();
    setStatus(s);
    if (s.notifEmail) setNotifEmail(s.notifEmail);
    if (s.weeklyDigest) setWeekly(true);
    if (s.approvalAlerts) setAlerts(true);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleAuth() {
    if (!email.trim() || password.length < 6) {
      setAuthMsg('Enter a valid email and a password of at least 6 characters.');
      return;
    }
    setAuthBusy(true);
    setAuthMsg('');
    try {
      if (authMode === 'signUp') {
        const result = await window.dojo.cloudSignUp({ email, password });
        if (!result.ok) { setAuthMsg(result.error ?? 'Authentication failed.'); return; }
        if (result.needsConfirmation) {
          setAuthMsg('Check your email to confirm your address, then sign in.');
          setAuthMode('signIn');
        } else {
          setAuthMsg('Account created and signed in.');
          await load();
        }
      } else {
        const result = await window.dojo.cloudSignIn({ email, password });
        if (!result.ok) { setAuthMsg(result.error ?? 'Authentication failed.'); return; }
        const pulled = result.pulled ?? 0;
        setAuthMsg(pulled > 0 ? `Signed in — pulled ${pulled} records from cloud.` : 'Signed in successfully.');
        await load();
      }
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignOut() {
    await window.dojo.cloudSignOut();
    setAuthMsg('');
    setSyncMsg('');
    await load();
  }

  async function handleSyncNow() {
    setSyncing(true);
    setSyncMsg('');
    const result = await window.dojo.cloudSyncNow();
    setSyncing(false);
    setSyncMsg(result.ok
      ? `Sync complete — ${result.pulled ?? 0} records pulled.`
      : `Sync failed: ${result.error}`);
    await load();
  }

  async function handleSaveEmail() {
    setEmailBusy(true);
    setEmailMsg('');
    try {
      await window.dojo.cloudSaveEmailConfig({ resendKey, notifEmail, weeklyDigest, approvalAlerts });
      setEmailMsg('Email settings saved.');
      await load();
    } finally {
      setEmailBusy(false);
    }
  }

  async function handleTestEmail() {
    if (!resendKey || !notifEmail) {
      setEmailMsg('Enter your Resend API key and a notification email first.');
      return;
    }
    setEmailBusy(true);
    setEmailMsg('Sending…');
    const result = await window.dojo.cloudSendTestEmail({ apiKey: resendKey, to: notifEmail });
    setEmailBusy(false);
    setEmailMsg(result.ok
      ? 'Test email sent! Check your inbox.'
      : 'Failed — check your Resend API key and sender domain.');
  }

  if (loading) {
    return <div className="text-dojo-muted text-sm animate-pulse">Loading cloud sync status…</div>;
  }

  const msgClass = (msg: string, ok: string, err: string) =>
    `text-sm px-3 py-2 rounded-xl ${msg.startsWith('Sync failed') || msg.startsWith('Failed') || msg.startsWith('Enter') ? err : ok}`;

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Not configured warning */}
      {!status?.configured && (
        <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 rounded-2xl px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <span className="text-xl shrink-0">⚠️</span>
          <div>
            <div className="font-semibold mb-0.5">Supabase not configured</div>
            <div>Copy <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">.env.example</code> to <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">.env</code>, fill in your Supabase URL and anon key, then restart. Run <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">supabase/schema.sql</code> in the Supabase SQL editor first.</div>
          </div>
        </div>
      )}

      {/* ── Connection status ── */}
      <div className="dojo-card">
        <div className="font-display font-semibold text-lg mb-4">☁️ Cloud account</div>

        {status?.connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl">
              <span className="text-2xl">✅</span>
              <div>
                <div className="font-semibold">{status.email}</div>
                <div className="text-xs text-dojo-muted">Last sync: {timeAgo(status.lastSync)}</div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                className="dojo-btn-primary text-sm"
                disabled={syncing}
                onClick={handleSyncNow}
              >
                {syncing ? '⟳ Syncing…' : '⟳ Sync now'}
              </button>
              <button
                className="px-4 py-2 text-sm font-medium text-dojo-danger border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition"
                onClick={handleSignOut}
              >
                Sign out
              </button>
            </div>

            {syncMsg && (
              <div className={msgClass(syncMsg,
                'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300',
                'bg-red-50 dark:bg-red-950/30 text-dojo-danger')}>
                {syncMsg}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2 mb-1">
              {(['signIn', 'signUp'] as const).map(m => (
                <button
                  key={m}
                  className={`px-4 py-1.5 rounded-xl text-sm font-medium border transition ${authMode === m ? 'bg-dojo-primary text-white border-dojo-primary' : 'border-slate-200 dark:border-slate-600 hover:border-dojo-primary/40'}`}
                  onClick={() => { setAuthMode(m); setAuthMsg(''); }}
                >
                  {m === 'signIn' ? 'Sign in' : 'Create account'}
                </button>
              ))}
            </div>

            <input
              className="dojo-input w-full"
              type="email"
              placeholder="Email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <input
              className="dojo-input w-full"
              type="password"
              placeholder="Password (min 6 characters)"
              value={password}
              onChange={e => setPw(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAuth()}
            />

            <button
              className="dojo-btn-primary"
              disabled={authBusy || !status?.configured}
              onClick={handleAuth}
            >
              {authBusy ? '…' : authMode === 'signIn' ? 'Sign in' : 'Create account'}
            </button>

            {authMsg && (
              <div className={`text-sm px-3 py-2 rounded-xl ${authMsg.includes('failed') || authMsg.includes('Enter') ? 'bg-red-50 dark:bg-red-950/30 text-dojo-danger' : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'}`}>
                {authMsg}
              </div>
            )}

            <p className="text-xs text-dojo-muted">
              Cloud sync lets you use DutyDojo on multiple computers. Data is stored in your own Supabase project with row-level security — only you can read it.
            </p>
          </div>
        )}
      </div>

      {/* ── Email notifications ── */}
      <div className="dojo-card">
        <div className="font-display font-semibold text-lg mb-1">✉️ Email notifications</div>
        <p className="text-xs text-dojo-muted mb-4">
          Uses <strong>Resend</strong> — free up to 3,000 emails/month. Get your API key at <strong>resend.com</strong>.
          For sign-up confirmation and password reset emails, configure Resend as the SMTP provider in your Supabase dashboard under Authentication → SMTP.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-dojo-muted mb-1">Resend API key</label>
            <input
              className="dojo-input w-full font-mono text-sm"
              type="password"
              placeholder="re_••••••••••••••••••••"
              value={resendKey}
              onChange={e => setResendKey(e.target.value)}
            />
            {status?.resendKey && !resendKey && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">✓ API key saved (leave blank to keep existing)</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-dojo-muted mb-1">Notification email</label>
            <input
              className="dojo-input w-full"
              type="email"
              placeholder="you@example.com"
              value={notifEmail}
              onChange={e => setNotifEmail(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2 py-1">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4 h-4 rounded accent-dojo-primary"
                checked={weeklyDigest}
                onChange={e => setWeekly(e.target.checked)}
              />
              <div>
                <div className="text-sm font-medium">Weekly digest</div>
                <div className="text-xs text-dojo-muted">Family summary every Monday at 8am</div>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4 h-4 rounded accent-dojo-primary"
                checked={approvalAlerts}
                onChange={e => setAlerts(e.target.checked)}
              />
              <div>
                <div className="text-sm font-medium">Approval alerts</div>
                <div className="text-xs text-dojo-muted">Email when a child submits a behaviour for review</div>
              </div>
            </label>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              className="dojo-btn-primary text-sm"
              disabled={emailBusy}
              onClick={handleSaveEmail}
            >
              {emailBusy ? '…' : 'Save email settings'}
            </button>
            <button
              className="dojo-btn-ghost text-sm"
              disabled={emailBusy}
              onClick={handleTestEmail}
            >
              Send test email
            </button>
          </div>

          {emailMsg && (
            <div className={`text-sm px-3 py-2 rounded-xl ${emailMsg.startsWith('Failed') || emailMsg.startsWith('Enter') ? 'bg-red-50 dark:bg-red-950/30 text-dojo-danger' : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'}`}>
              {emailMsg}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
