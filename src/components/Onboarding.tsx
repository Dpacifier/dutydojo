import { useState } from 'react';
import { useApp } from '../store';

const RECOVERY_QUESTIONS = [
  "What was the name of your first pet?",
  "What city were you born in?",
  "What was the name of your primary school?",
  "What was your childhood nickname?",
  "What is your oldest sibling's middle name?",
  "What street did you grow up on?",
  "What was the make of your first car?",
  "What was your mother's maiden name?",
];

export function Onboarding() {
  const bootstrap = useApp((s) => s.bootstrap);
  const unlockParent = useApp((s) => s.unlockParent);

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 — parent credentials
  const [parentName, setParentName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  // Step 2 — recovery question
  const [question, setQuestion] = useState(RECOVERY_QUESTIONS[0]);
  const [answer, setAnswer] = useState('');
  const [confirmAnswer, setConfirmAnswer] = useState('');

  // Step 3 — first child
  const [childName, setChildName] = useState('');
  const [childEmoji, setChildEmoji] = useState('🥋');
  const [goal, setGoal] = useState(100);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function next() {
    setError(null);

    if (step === 1) {
      if (!parentName.trim()) return setError('Please enter your name');
      if (password.length < 4) return setError('Password must be at least 4 characters');
      if (password !== confirm) return setError('Passwords do not match');
      setStep(2);
      return;
    }

    if (step === 2) {
      if (!answer.trim()) return setError('Please enter a recovery answer');
      if (answer.trim().toLowerCase() !== confirmAnswer.trim().toLowerCase())
        return setError('Answers do not match');
      setStep(3);
      return;
    }

    // Step 3 — create everything
    if (!childName.trim()) return setError('Please enter at least one child name');
    setBusy(true);
    try {
      await window.dojo.setupParent({ name: parentName.trim(), password });
      await window.dojo.setRecovery({ question, answer });
      await window.dojo.addChild({ name: childName.trim(), avatarEmoji: childEmoji, goalPoints: goal });
      unlockParent();
      await bootstrap();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const stepLabel = step === 1 ? '1/3' : step === 2 ? '2/3' : '3/3';

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="dojo-card max-w-lg w-full">
        <div className="flex items-center gap-3 mb-6">
          <div className="text-4xl">🥋</div>
          <div>
            <div className="font-display text-2xl font-bold">Welcome to DutyDojo</div>
            <div className="text-sm text-dojo-muted">Let's set up your family ({stepLabel})</div>
          </div>
        </div>

        {/* ── Step 1: parent credentials ── */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Parent name</label>
              <input
                className="dojo-input mt-1"
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                placeholder="e.g. Mum"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Parent password</label>
              <input
                type="password"
                className="dojo-input mt-1"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Kids should not know this"
              />
              <div className="text-xs text-dojo-muted mt-1">
                Used to unlock the parent portal. Pick something your children can't guess.
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Confirm password</label>
              <input
                type="password"
                className="dojo-input mt-1"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* ── Step 2: recovery question ── */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
              <span className="text-xl shrink-0">🔑</span>
              <p>
                Set a recovery question so you can reset your password without losing any data
                if you ever forget it.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Security question</label>
              <select
                className="dojo-input mt-1"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              >
                {RECOVERY_QUESTIONS.map((q) => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Your answer</label>
              <input
                className="dojo-input mt-1"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Answer (case-insensitive)"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Confirm answer</label>
              <input
                className="dojo-input mt-1"
                value={confirmAnswer}
                onChange={(e) => setConfirmAnswer(e.target.value)}
                placeholder="Repeat your answer"
                autoComplete="off"
              />
            </div>
          </div>
        )}

        {/* ── Step 3: first child ── */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Child name</label>
              <input
                className="dojo-input mt-1"
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                placeholder="e.g. Ada"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Avatar</label>
              <div className="flex gap-2 flex-wrap mt-2">
                {['🥋', '⭐', '🦄', '🐯', '🦊', '🐼', '🐸', '🚀', '🦖', '🎸'].map((e) => (
                  <button
                    key={e}
                    className={`text-3xl w-12 h-12 rounded-xl border ${
                      childEmoji === e ? 'border-dojo-primary bg-violet-50' : 'border-slate-200'
                    }`}
                    onClick={() => setChildEmoji(e)}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Goal points (milestone)</label>
              <input
                type="number"
                className="dojo-input mt-1"
                value={goal}
                min={10}
                onChange={(e) => setGoal(Number(e.target.value))}
              />
              <div className="text-xs text-dojo-muted mt-1">
                When they reach this, confetti rains and a trophy appears. You can add more children and tweak later.
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 text-sm text-dojo-danger bg-red-50 border border-red-100 rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex justify-between mt-6">
          {step > 1 ? (
            <button
              className="dojo-btn-ghost"
              onClick={() => { setError(null); setStep((s) => (s - 1) as 1 | 2 | 3); }}
            >
              ← Back
            </button>
          ) : (
            <span />
          )}
          <button className="dojo-btn-primary" onClick={next} disabled={busy}>
            {busy
              ? 'Setting up…'
              : step === 3
              ? 'Start the DutyDojo 🎉'
              : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}
