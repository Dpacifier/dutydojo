import { useState } from 'react';
import { getClient } from '../webApi';

interface Props {
  onDone: () => void;
}

export function SetNewPassword({ onDone }: Props) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error: err } = await getClient().auth.updateUser({ password });
    setLoading(false);

    if (err) {
      setError(err.message);
    } else {
      setSuccess(true);
      // Sign out so the user signs in fresh with the new password
      await getClient().auth.signOut();
      setTimeout(onDone, 2500);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 p-4">
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl p-8 w-full max-w-sm text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="font-display text-xl font-bold mb-2">Password updated!</h2>
          <p className="text-dojo-muted text-sm">
            Your password has been changed. Taking you to sign in…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">🔑</div>
          <h1 className="font-display text-2xl font-bold text-dojo-ink dark:text-white">New password</h1>
          <p className="text-dojo-muted text-sm mt-1">Choose a strong password to secure your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-dojo-muted mb-1">New password</label>
            <input
              type="password"
              required
              autoComplete="new-password"
              className="dojo-input w-full"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-dojo-muted mb-1">Confirm new password</label>
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
            {loading ? '…' : 'Set new password'}
          </button>
        </form>

        <p className="text-center text-xs text-dojo-muted mt-6">
          © {new Date().getFullYear()} Switch IT Global Limited · Co. No. 11001626
        </p>
      </div>
    </div>
  );
}
