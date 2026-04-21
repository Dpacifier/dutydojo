import { useEffect, useState } from 'react';
import { useApp } from '../store';

type Screen = 'login' | 'recovery-question' | 'recovery-reset' | 'recovery-done';

export function ParentLogin() {
  const unlockParent = useApp((s) => s.unlockParent);
  const setView = useApp((s) => s.setView);

  // ── Login ──
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // ── Recovery ──
  const [screen, setScreen] = useState<Screen>('login');
  const [hasRecovery, setHasRecovery] = useState(false);
  const [recoveryQuestion, setRecoveryQuestion] = useState<string | null>(null);
  const [recoveryAnswer, setRecoveryAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  // Check once on mount whether a recovery question has been configured
  useEffect(() => {
    window.dojo.hasRecovery()
      .then((ok) => setHasRecovery(ok))
      .catch(() => {});
  }, []);

  // ── Login submit ──
  async function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    setBusy(true);
    try {
      const ok = await window.dojo.verifyParent(password);
      if (!ok) {
        setLoginError('Incorrect password');
        return;
      }
      unlockParent();
      setView({ name: 'parent-portal', tab: 'children' });
    } finally {
      setBusy(false);
    }
  }

  // ── Recovery: load question then show it ──
  async function startRecovery() {
    setRecoveryError(null);
    setRecoveryAnswer('');
    setNewPassword('');
    setConfirmPassword('');
    const q = await window.dojo.getRecoveryQuestion();
    setRecoveryQuestion(q);
    setScreen('recovery-question');
  }

  // ── Recovery: verify answer ──
  async function submitAnswer(e: React.FormEvent) {
    e.preventDefault();
    setRecoveryError(null);
    if (!recoveryAnswer.trim()) return setRecoveryError('Please enter your answer');
    // We just move to the "set new password" screen — the actual verify happens on final submit
    // so the bcrypt round-trip is only done once
    setScreen('recovery-reset');
  }

  // ── Recovery: verify + reset ──
  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    setRecoveryError(null);
    if (newPassword.length < 4) return setRecoveryError('Password must be at least 4 characters');
    if (newPassword !== confirmPassword) return setRecoveryError('Passwords do not match');
    setBusy(true);
    try {
      const ok = await window.dojo.verifyRecoveryAndReset({
        answer: recoveryAnswer,
        newPassword,
      });
      if (!ok) {
        setRecoveryError('Recovery answer was incorrect — please go back and try again');
        return;
      }
      setScreen('recovery-done');
    } finally {
      setBusy(false);
    }
  }

  // ── Screens ──

  if (screen === 'recovery-question') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <form className="dojo-card max-w-md w-full" onSubmit={submitAnswer}>
          <div className="flex items-center gap-3 mb-5">
            <div className="text-4xl">🔑</div>
            <div>
              <div className="font-display text-xl font-bold">Password recovery</div>
              <div className="text-sm text-dojo-muted">Answer your security question</div>
            </div>
          </div>

          {recoveryQuestion ? (
            <>
              <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-medium">
                {recoveryQuestion}
              </div>
              <input
                autoFocus
                className="dojo-input"
                placeholder="Your answer (case-insensitive)"
                value={recoveryAnswer}
                onChange={(e) => setRecoveryAnswer(e.target.value)}
                autoComplete="off"
              />
            </>
          ) : (
            <div className="text-sm text-dojo-muted bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
              No recovery question has been set up yet. Head into Settings → Security after logging
              in (by some other means) to configure one.
            </div>
          )}

          {recoveryError && (
            <div className="mt-3 text-sm text-dojo-danger bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {recoveryError}
            </div>
          )}

          <div className="flex justify-between mt-5">
            <button
              type="button"
              className="dojo-btn-ghost"
              onClick={() => { setScreen('login'); setLoginError(null); }}
            >
              ← Back to login
            </button>
            {recoveryQuestion && (
              <button className="dojo-btn-primary" type="submit">
                Next →
              </button>
            )}
          </div>
        </form>
      </div>
    );
  }

  if (screen === 'recovery-reset') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <form className="dojo-card max-w-md w-full" onSubmit={submitReset}>
          <div className="flex items-center gap-3 mb-5">
            <div className="text-4xl">🔓</div>
            <div>
              <div className="font-display text-xl font-bold">Set a new password</div>
              <div className="text-sm text-dojo-muted">Your data will be kept safe</div>
            </div>
          </div>

          <div className="space-y-3">
            <input
              autoFocus
              type="password"
              className="dojo-input"
              placeholder="New password (min 4 characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <input
              type="password"
              className="dojo-input"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          {recoveryError && (
            <div className="mt-3 text-sm text-dojo-danger bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {recoveryError}
            </div>
          )}

          <div className="flex justify-between mt-5">
            <button
              type="button"
              className="dojo-btn-ghost"
              onClick={() => { setScreen('recovery-question'); setRecoveryError(null); }}
            >
              ← Back
            </button>
            <button className="dojo-btn-primary" type="submit" disabled={busy}>
              {busy ? 'Resetting…' : 'Reset password'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (screen === 'recovery-done') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="dojo-card max-w-md w-full text-center">
          <div className="text-6xl mb-3">✅</div>
          <div className="font-display text-xl font-bold mb-2">Password reset!</div>
          <div className="text-sm text-dojo-muted mb-5">
            Your new password is set and all your data is intact. Go ahead and log in.
          </div>
          <button
            className="dojo-btn-primary"
            onClick={() => { setScreen('login'); setPassword(''); setLoginError(null); }}
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  // ── Default: login screen ──
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form className="dojo-card max-w-md w-full" onSubmit={submitLogin}>
        <div className="flex items-center gap-3 mb-5">
          <div className="text-4xl">🔒</div>
          <div>
            <div className="font-display text-xl font-bold">Parent portal</div>
            <div className="text-sm text-dojo-muted">Enter your password to continue</div>
          </div>
        </div>
        <input
          autoFocus
          type="password"
          className="dojo-input"
          placeholder="Parent password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {loginError && (
          <div className="mt-3 text-sm text-dojo-danger bg-red-50 border border-red-100 rounded-xl px-3 py-2">
            {loginError}
          </div>
        )}
        <div className="flex justify-between mt-5">
          <button type="button" className="dojo-btn-ghost" onClick={() => setView({ name: 'kid' })}>
            ← Back to kid view
          </button>
          <button className="dojo-btn-primary" disabled={busy}>
            {busy ? 'Checking…' : 'Unlock'}
          </button>
        </div>
        {hasRecovery && (
          <div className="mt-4 text-center">
            <button
              type="button"
              className="text-sm text-dojo-primary hover:underline"
              onClick={startRecovery}
            >
              Forgot password?
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
