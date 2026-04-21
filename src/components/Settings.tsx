import { useEffect, useState } from 'react';
import { useApp } from '../store';
import type { ParentSettings } from '../types';
import { CloudSyncSettings } from './CloudSyncSettings';

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

export function Settings() {
  const refreshSettings = useApp((s) => s.refreshSettings);

  // ── Password change ──
  const [oldPw, setOldPw]   = useState('');
  const [newPw, setNewPw]   = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwMsg, setPwMsg]   = useState<{ ok: boolean; text: string } | null>(null);

  // ── Recovery question ──
  const [recoveryQuestion, setRecoveryQuestion]   = useState(RECOVERY_QUESTIONS[0]);
  const [recoveryAnswer, setRecoveryAnswer]       = useState('');
  const [confirmRecoveryAnswer, setConfirmRecovery] = useState('');
  const [recoveryCurrentQ, setRecoveryCurrentQ]  = useState<string | null>(null);
  const [recoveryMsg, setRecoveryMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // ── Backup / restore ──
  const [backupMsg, setBackupMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);

  // ── Default child settings ──
  const [defaults, setDefaults] = useState<ParentSettings>({
    default_start_points: 0,
    default_goal_points: 100,
    default_threshold: 0,
    require_approval: 0,
    max_points_per_day: 0,
  });

  // ── Kid PIN ──
  const [kidPinExists, setKidPinExists]   = useState(false);
  const [newKidPin, setNewKidPin]         = useState('');
  const [confirmKidPin, setConfirmKidPin] = useState('');
  const [kidPinMsg, setKidPinMsg]         = useState<{ ok: boolean; text: string } | null>(null);
  const [settingsMsg, setSettingsMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Load saved defaults + current recovery question + kid PIN on mount
  useEffect(() => {
    (async () => {
      const [s, q, hasPIN] = await Promise.all([
        window.dojo.getSettings(),
        window.dojo.getRecoveryQuestion(),
        window.dojo.hasKidPin(),
      ]);
      setDefaults(s);
      setRecoveryCurrentQ(q);
      setKidPinExists(hasPIN);
      if (q) {
        setRecoveryQuestion(RECOVERY_QUESTIONS.includes(q) ? q : RECOVERY_QUESTIONS[0]);
      }
    })();
  }, []);

  async function saveKidPin() {
    setKidPinMsg(null);
    if (!/^\d{4}$/.test(newKidPin)) return setKidPinMsg({ ok: false, text: 'PIN must be exactly 4 digits' });
    if (newKidPin !== confirmKidPin) return setKidPinMsg({ ok: false, text: 'PINs do not match' });
    await window.dojo.setKidPin(newKidPin);
    setKidPinExists(true);
    setNewKidPin('');
    setConfirmKidPin('');
    setKidPinMsg({ ok: true, text: 'Kid PIN set ✅' });
  }

  async function clearKidPin() {
    const confirmed = window.confirm('Remove the kid PIN? Children will be able to access their screen without entering a PIN.');
    if (!confirmed) return;
    await window.dojo.clearKidPin();
    setKidPinExists(false);
    setNewKidPin('');
    setConfirmKidPin('');
    setKidPinMsg({ ok: true, text: 'Kid PIN removed' });
  }

  async function changePassword() {
    setPwMsg(null);
    if (newPw.length < 4) return setPwMsg({ ok: false, text: 'New password too short (min 4 chars)' });
    if (newPw !== confirm) return setPwMsg({ ok: false, text: 'New passwords do not match' });
    const ok = await window.dojo.changeParentPassword({ oldPassword: oldPw, newPassword: newPw });
    if (ok) {
      setPwMsg({ ok: true, text: 'Password updated ✅' });
      setOldPw('');
      setNewPw('');
      setConfirm('');
    } else {
      setPwMsg({ ok: false, text: 'Current password is incorrect' });
    }
  }

  async function saveRecovery() {
    setRecoveryMsg(null);
    if (!recoveryAnswer.trim()) return setRecoveryMsg({ ok: false, text: 'Please enter an answer' });
    if (recoveryAnswer.trim().toLowerCase() !== confirmRecoveryAnswer.trim().toLowerCase())
      return setRecoveryMsg({ ok: false, text: 'Answers do not match' });
    await window.dojo.setRecovery({ question: recoveryQuestion, answer: recoveryAnswer });
    setRecoveryCurrentQ(recoveryQuestion);
    setRecoveryAnswer('');
    setConfirmRecovery('');
    setRecoveryMsg({ ok: true, text: 'Recovery question updated ✅' });
  }

  async function doBackupExport() {
    if (backupBusy) return;
    setBackupBusy(true);
    setBackupMsg(null);
    try {
      const res = await window.dojo.backupExport();
      if (res.ok) {
        setBackupMsg({ ok: true, text: `✅ Backup saved to ${res.path ?? 'your documents folder'}` });
      } else {
        setBackupMsg({ ok: false, text: res.message ?? 'Backup failed' });
      }
    } finally {
      setBackupBusy(false);
    }
  }

  async function doBackupRestore() {
    if (backupBusy) return;
    const confirmed = window.confirm(
      'Restoring a backup will restart the app and replace all current data. Continue?'
    );
    if (!confirmed) return;
    setBackupBusy(true);
    setBackupMsg(null);
    try {
      const res = await window.dojo.backupRestore();
      if (!res.ok) {
        setBackupMsg({ ok: false, text: res.message ?? 'Restore failed' });
      }
      // If ok, app will relaunch automatically
    } finally {
      setBackupBusy(false);
    }
  }

  async function saveDefaults() {
    setSettingsMsg(null);
    if (defaults.default_goal_points < 10) {
      return setSettingsMsg({ ok: false, text: 'Goal points must be at least 10' });
    }
    const ok = await window.dojo.saveSettings(defaults);
    if (ok) {
      await refreshSettings(); // sync requireApproval into the store immediately
      setSettingsMsg({ ok: true, text: 'Defaults saved ✅' });
    } else {
      setSettingsMsg({ ok: false, text: 'Failed to save settings' });
    }
  }

  return (
    <div className="max-w-lg space-y-6">

      {/* ── Default values for new children ── */}
      <div className="dojo-card">
        <div className="font-display font-semibold text-lg mb-1">Default values for new children</div>
        <div className="text-sm text-dojo-muted mb-4">
          These values pre-fill the "Add a child" form whenever you create a new child.
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-dojo-muted mb-1 uppercase tracking-wide">
              Starting points
            </label>
            <input
              type="number"
              className="dojo-input"
              placeholder="e.g. 0"
              value={defaults.default_start_points}
              min={0}
              onChange={(e) =>
                setDefaults((d) => ({ ...d, default_start_points: Number(e.target.value) }))
              }
            />
            <div className="text-xs text-dojo-muted mt-1">
              Points a new child starts with. Set to 0 to start from scratch.
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-dojo-muted mb-1 uppercase tracking-wide">
              Goal points
            </label>
            <input
              type="number"
              className="dojo-input"
              placeholder="e.g. 100"
              value={defaults.default_goal_points}
              min={10}
              onChange={(e) =>
                setDefaults((d) => ({ ...d, default_goal_points: Number(e.target.value) }))
              }
            />
            <div className="text-xs text-dojo-muted mt-1">
              Points needed to earn a trophy milestone.
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-dojo-muted mb-1 uppercase tracking-wide">
              Needs attention threshold
            </label>
            <input
              type="number"
              className="dojo-input"
              placeholder="e.g. 50 (0 = off)"
              value={defaults.default_threshold}
              min={0}
              onChange={(e) =>
                setDefaults((d) => ({ ...d, default_threshold: Number(e.target.value) }))
              }
            />
            <div className="text-xs text-dojo-muted mt-1">
              A warning alert triggers if a child's balance drops to or below this value. Set to 0 to disable.
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-dojo-muted mb-1 uppercase tracking-wide">
              Daily point cap <span className="font-normal normal-case">(0 = unlimited)</span>
            </label>
            <input
              type="number"
              className="dojo-input"
              placeholder="e.g. 50 (0 = unlimited)"
              value={defaults.max_points_per_day}
              min={0}
              onChange={(e) =>
                setDefaults((d) => ({ ...d, max_points_per_day: Number(e.target.value) }))
              }
            />
            <div className="text-xs text-dojo-muted mt-1">
              Maximum points a child can earn in a single day across all behaviours. Set to 0 to disable.
            </div>
          </div>

          {/* Approval mode toggle */}
          <div className={`flex items-start justify-between gap-4 p-4 rounded-xl border transition ${
            defaults.require_approval
              ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-700'
              : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
          }`}>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span>✋</span>
                <span className="text-sm font-semibold">Require parent approval</span>
              </div>
              <div className="text-xs text-dojo-muted mt-1">
                When on, children's behaviour taps are queued for review. Points are only
                applied after a parent approves them in the Approvals tab.
              </div>
            </div>
            <button
              role="switch"
              aria-checked={!!defaults.require_approval}
              onClick={() =>
                setDefaults((d) => ({ ...d, require_approval: d.require_approval ? 0 : 1 }))
              }
              className={`relative mt-0.5 shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none ${
                defaults.require_approval ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  defaults.require_approval ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {settingsMsg && (
            <div
              className={`text-sm px-3 py-2 rounded-xl border ${
                settingsMsg.ok
                  ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                  : 'bg-red-50 border-red-100 text-dojo-danger'
              }`}
            >
              {settingsMsg.text}
            </div>
          )}

          <button className="dojo-btn-primary" onClick={saveDefaults}>
            Save defaults
          </button>
        </div>
      </div>

      {/* ── Kid PIN ── */}
      <div className="dojo-card">
        <div className="font-display font-semibold text-lg mb-1">Kid PIN</div>
        <div className="text-sm text-dojo-muted mb-4">
          Set a 4-digit PIN that children must enter before accessing their screen.
          {kidPinExists && (
            <span className="block mt-1 text-xs text-dojo-primary font-semibold">✅ A PIN is currently set</span>
          )}
        </div>
        <div className="space-y-3">
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            className="dojo-input tracking-widest text-center text-xl"
            placeholder="New 4-digit PIN"
            value={newKidPin}
            onChange={(e) => setNewKidPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          />
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            className="dojo-input tracking-widest text-center text-xl"
            placeholder="Confirm PIN"
            value={confirmKidPin}
            onChange={(e) => setConfirmKidPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          />
          {kidPinMsg && (
            <div
              className={`text-sm px-3 py-2 rounded-xl border ${
                kidPinMsg.ok
                  ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                  : 'bg-red-50 border-red-100 text-dojo-danger'
              }`}
            >
              {kidPinMsg.text}
            </div>
          )}
          <div className="flex gap-3 flex-wrap">
            <button className="dojo-btn-primary" onClick={saveKidPin}>
              {kidPinExists ? 'Update PIN' : 'Set PIN'}
            </button>
            {kidPinExists && (
              <button
                className="px-4 py-2 rounded-xl border border-dojo-danger/40 text-dojo-danger text-sm hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                onClick={clearKidPin}
              >
                Remove PIN
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Change password ── */}
      <div className="dojo-card">
        <div className="font-display font-semibold text-lg mb-3">Change parent password</div>
        <div className="space-y-3">
          <input
            type="password"
            className="dojo-input"
            placeholder="Current password"
            value={oldPw}
            onChange={(e) => setOldPw(e.target.value)}
          />
          <input
            type="password"
            className="dojo-input"
            placeholder="New password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
          />
          <input
            type="password"
            className="dojo-input"
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {pwMsg && (
            <div
              className={`text-sm px-3 py-2 rounded-xl border ${
                pwMsg.ok
                  ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                  : 'bg-red-50 border-red-100 text-dojo-danger'
              }`}
            >
              {pwMsg.text}
            </div>
          )}
          <button className="dojo-btn-primary" onClick={changePassword}>
            Update password
          </button>
        </div>
      </div>

      {/* ── Recovery question ── */}
      <div className="dojo-card">
        <div className="font-display font-semibold text-lg mb-1">Password recovery</div>
        <div className="text-sm text-dojo-muted mb-4">
          If you ever forget your password, answering this question lets you reset it without
          losing any data.
          {recoveryCurrentQ && (
            <span className="block mt-1 text-xs text-dojo-primary">
              Current question: <em>{recoveryCurrentQ}</em>
            </span>
          )}
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-dojo-muted mb-1 uppercase tracking-wide">
              Security question
            </label>
            <select
              className="dojo-input"
              value={recoveryQuestion}
              onChange={(e) => setRecoveryQuestion(e.target.value)}
            >
              {RECOVERY_QUESTIONS.map((q) => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </div>
          <input
            className="dojo-input"
            placeholder="New answer (case-insensitive)"
            value={recoveryAnswer}
            onChange={(e) => setRecoveryAnswer(e.target.value)}
            autoComplete="off"
          />
          <input
            className="dojo-input"
            placeholder="Confirm answer"
            value={confirmRecoveryAnswer}
            onChange={(e) => setConfirmRecovery(e.target.value)}
            autoComplete="off"
          />
          {recoveryMsg && (
            <div
              className={`text-sm px-3 py-2 rounded-xl border ${
                recoveryMsg.ok
                  ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                  : 'bg-red-50 border-red-100 text-dojo-danger'
              }`}
            >
              {recoveryMsg.text}
            </div>
          )}
          <button className="dojo-btn-primary" onClick={saveRecovery}>
            {recoveryCurrentQ ? 'Update recovery question' : 'Set recovery question'}
          </button>
        </div>
      </div>

      {/* ── Backup & Restore ── */}
      <div className="dojo-card">
        <div className="font-display font-semibold text-lg mb-1">Backup & restore</div>
        <div className="text-sm text-dojo-muted mb-4">
          Save a copy of your entire database to a file, or restore from a previous backup.
          All data — children, history, behaviours, rewards, and settings — is included.
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            className="dojo-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={doBackupExport}
            disabled={backupBusy}
          >
            {backupBusy ? '⏳ Working…' : '💾 Export backup'}
          </button>
          <button
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={doBackupRestore}
            disabled={backupBusy}
          >
            📂 Restore from backup
          </button>
        </div>
        {backupMsg && (
          <div
            className={`mt-3 text-sm px-3 py-2 rounded-xl border ${
              backupMsg.ok
                ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                : 'bg-red-50 border-red-100 text-dojo-danger'
            }`}
          >
            {backupMsg.text}
          </div>
        )}
        <div className="mt-3 text-xs text-dojo-muted">
          Restoring a backup will replace all current data and restart the app.
        </div>
      </div>

      {/* ── Cloud sync ── */}
      <CloudSyncSettings />

      {/* ── About ── */}
      <div className="dojo-card">
        <div className="font-display font-semibold text-lg mb-2">About</div>
        <div className="text-sm text-dojo-muted space-y-2">
          <p>
            DutyDojo — local data stored in SQLite, optionally synced to your own Supabase project.
          </p>
          <p>
            Next phases: mobile apps (iOS + Android), AI behaviour coaching.

          </p>
        </div>
      </div>

    </div>
  );
}
