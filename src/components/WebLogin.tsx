import { useState } from 'react';
import { getClient, initWebApi } from '../webApi';

type Mode = 'login' | 'signup';

interface Props {
  onSuccess: () => void;
}

export function WebLogin({ onSuccess }: Props) {
  const [mode, setMode]         = useState<Mode>('login');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false); // signup confirmation sent

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (mode === 'signup' && password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    const sb = getClient();

    if (mode === 'login') {
      const { data, error: err } = await sb.auth.signInWithPassword({ email, password });
      if (err || !data.session) {
        setError(err?.message ?? 'Sign-in failed. Check your email and password.');
        setLoading(false);
        return;
      }
      initWebApi(data.session.user.id);
      onSuccess();
    } else {
      const { data, error: err } = await sb.auth.signUp({ email, password });
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      // If email confirmation is disabled, session is available immediately
      if (data.session) {
        initWebApi(data.session.user.id);
        onSuccess();
      } else {
        setDone(true);
        setLoading(false);
      }
    }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 p-4">
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl p-8 w-full max-w-sm text-center">
          <div className="text-5xl mb-4">📬</div>
          <h2 className="font-display text-xl font-bold mb-2">Check your email</h2>
          <p className="text-dojo-muted text-sm">
            We sent a confirmation link to <strong>{email}</strong>.
            Click it to activate your account, then come back and sign in.
          </p>
          <button
            className="mt-6 text-dojo-primary text-sm font-semibold hover:underline"
            onClick={() => { setDone(false); setMode('login'); }}
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl p-8 w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">🥋</div>
          <h1 className="font-display text-2xl font-bold text-dojo-ink dark:text-white">DutyDojo</h1>
          <p className="text-dojo-muted text-sm mt-1">Family reward tracker</p>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 mb-6">
          {(['login', 'signup'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(''); }}
              className={`flex-1 py-2 text-sm font-semibold transition ${
                mode === m
                  ? 'bg-dojo-primary text-white'
                  : 'text-dojo-muted hover:text-dojo-ink dark:hover:text-white'
              }`}
            >
              {m === 'login' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-dojo-muted mb-1">Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              className="dojo-input w-full"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-dojo-muted mb-1">Password</label>
            <input
              type="password"
              required
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              className="dojo-input w-full"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-semibold text-dojo-muted mb-1">Confirm password</label>
              <input
                type="password"
                required
                autoComplete="new-password"
                className="dojo-input w-full"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
          )}

          {error && (
            <div className="text-sm text-dojo-danger bg-red-50 dark:bg-red-950/30 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="dojo-btn-primary w-full mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? '…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        {mode === 'login' && (
          <p className="text-center text-xs text-dojo-muted mt-4">
            No account yet?{' '}
            <button
              type="button"
              className="text-dojo-primary font-semibold hover:underline"
              onClick={() => { setMode('signup'); setError(''); }}
            >
              Create one free
            </button>
          </p>
        )}

        <p className="text-center text-xs text-dojo-muted mt-6">
          © {new Date().getFullYear()} Switch IT Global Limited · Co. No. 11001626
        </p>
      </div>
    </div>
  );
}
