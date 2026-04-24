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
  const [resetScreen, setResetScreen] = useState(false);
  const [resetEmail, setResetEmail]   = useState('');
  const [resetMsg, setResetMsg]       = useState('');
  const [resetBusy, setResetBusy]     = useState(false);
  const [email, setEmail]       = useState('');
  const [password, setPw]       = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authMsg, setAuthMsg]   = useState('');

  // Email config form
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

  async function handleReset() {
    if (!resetEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail)) {
      setResetMsg('Enter a valid email address.');
      return;
    }
    setResetBusy(true);
    setResetMsg('');
    try {
      const res = await window.dojo.cloudResetPassword(resetEmail.trim());
      if (res.ok) {
        setResetMsg('✅ Check your email for a password reset link.');
      } else {
        setResetMsg(res.error ?? 'Failed to send reset email.');
      }
    } finally {
      setResetBusy(false);
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
    if (notifEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notifEmail)) {
      setEmailMsg('Please enter a valid email address.');
      return;
    }
    setEmailBusy(true);
    setEmailMsg('');
    try {
      const ok = await window.dojo.cloudSaveEmailConfig({ resendKey: '', notifEmail, weeklyDigest, approvalAlerts });
      setEmailMsg(ok ? '✅ Notification settings saved.' : 'Failed to save. Please try again.');
      if (ok) await load();
    } finally {
      setEmailBusy(false);
    }
  }

  async function handleTestEmail() {
    if (!notifEmail) {
      setEmailMsg('Enter a notification email address first.');
      return;
    }
    setEmailBusy(true);
    setEmailMsg('Sending…');
    try {
      const result = await window.dojo.cloudSendTestEmail({ apiKey: '', to: notifEmail });
      setEmailMsg(result.ok
        ? '✅ Test email sent! Check your inbox.'
        : `Failed — ${(result as { ok: boolean; error?: string }).error ?? 'please try again later.'}`);
    } catch {
      setEmailMsg('Something went wrong. Check your connection and try again.');
    } finally {
      setEmailBusy(false);
    }
  }

  if (loading) {
    return <div className="text-dojo-muted text-sm animate-pulse">Loading cloud sync status…</div>;
  }

  const msgClass = (msg: string, ok: string, err: string) =>
    `text-sm px-3 py-2 rounded-xl ${msg.startsWith('Sync failed') || msg.startsWith('Failed') || msg.startsWith('Enter') ? err : ok}`;

  return (
    <div className="space-y-6 max-w-2xl">

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

            {resetScreen ? (
              /* ── Forgot password flow ── */
              <>
                <div className="font-semibold text-sm mb-1">Reset your password</div>
                <p className="text-xs text-dojo-muted mb-2">
                  Enter your account email and we'll send you a reset link.
                </p>
                <input
                  className="dojo-input w-full"
                  type="email"
                  placeholder="Email address"
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleReset()}
                  autoFocus
                />
                <button
                  className="dojo-btn-primary"
                  disabled={resetBusy || !status?.configured}
                  onClick={handleReset}
                >
                  {resetBusy ? '…' : 'Send reset link'}
                </button>
                {resetMsg && (
                  <div className={`text-sm px-3 py-2 rounded-xl ${resetMsg.startsWith('✅') ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-950/30 text-dojo-danger'}`}>
                    {resetMsg}
                  </div>
                )}
                <button
                  className="text-xs text-dojo-primary hover:underline"
                  onClick={() => { setResetScreen(false); setResetMsg(''); }}
                >
                  ← Back to sign in
                </button>
              </>
            ) : (
              /* ── Normal sign-in / sign-up ── */
              <>
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

                <div className="flex items-center justify-between gap-2">
                  <button
                    className="dojo-btn-primary"
                    disabled={authBusy || !status?.configured}
                    onClick={handleAuth}
                  >
                    {authBusy ? '…' : authMode === 'signIn' ? 'Sign in' : 'Create account'}
                  </button>
                  {authMode === 'signIn' && (
                    <button
                      className="text-xs text-dojo-primary hover:underline shrink-0"
                      onClick={() => { setResetScreen(true); setResetEmail(email); setResetMsg(''); }}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>

                {authMsg && (
                  <div className={`text-sm px-3 py-2 rounded-xl ${authMsg.includes('failed') || authMsg.includes('Enter') ? 'bg-red-50 dark:bg-red-950/30 text-dojo-danger' : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'}`}>
                    {authMsg}
                  </div>
                )}

                <p className="text-xs text-dojo-muted">
                  Cloud sync lets you use DutyDojo on multiple computers. Data is stored in your own Supabase project with row-level security — only you can read it.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Email notifications ── */}
      <div className="dojo-card">
        <div className="font-display font-semibold text-lg mb-1">✉️ Email notifications</div>
        <p className="text-sm text-dojo-muted mb-4">
          Enter the email address where you'd like to receive notifications. No setup required —
          emails are sent automatically by DutyDojo.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-dojo-muted mb-1 uppercase tracking-wide">
              Notification email
            </label>
            <input
              className="dojo-input w-full"
              type="email"
              placeholder="you@example.com"
              value={notifEmail}
              onChange={e => setNotifEmail(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-3">
            <label className={`flex items-start gap-3 cursor-pointer select-none p-3 rounded-xl border transition ${
              weeklyDigest
                ? 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-700'
                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
            }`}>
              <input
                type="checkbox"
                className="mt-0.5 w-4 h-4 rounded accent-dojo-primary shrink-0"
                checked={weeklyDigest}
                onChange={e => setWeekly(e.target.checked)}
              />
              <div>
                <div className="text-sm font-semibold">📊 Weekly digest</div>
                <div className="text-xs text-dojo-muted mt-0.5">
                  A family summary email every Monday — balances, points earned, and streaks for each child.
                </div>
              </div>
            </label>

            <label className={`flex items-start gap-3 cursor-pointer select-none p-3 rounded-xl border transition ${
              approvalAlerts
                ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-700'
                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
            }`}>
              <input
                type="checkbox"
                className="mt-0.5 w-4 h-4 rounded accent-dojo-primary shrink-0"
                checked={approvalAlerts}
                onChange={e => setAlerts(e.target.checked)}
              />
              <div>
                <div className="text-sm font-semibold">✋ Approval alerts</div>
                <div className="text-xs text-dojo-muted mt-0.5">
                  Get an email the moment a child submits a behaviour waiting for your review.
                </div>
              </div>
            </label>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              className="dojo-btn-primary text-sm"
              disabled={emailBusy}
              onClick={handleSaveEmail}
            >
              {emailBusy ? '⏳ Saving…' : 'Save notification settings'}
            </button>
            <button
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-50"
              disabled={emailBusy || !notifEmail}
              onClick={handleTestEmail}
            >
              Send test email
            </button>
          </div>

          {emailMsg && (
            <div className={`text-sm px-3 py-2 rounded-xl border ${
              emailMsg.startsWith('✅')
                ? 'bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300'
                : 'bg-red-50 border-red-100 text-dojo-danger dark:bg-red-950/30 dark:border-red-800'
            }`}>
              {emailMsg}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
