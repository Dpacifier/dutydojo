import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Child, Consequence, Reward } from '../types';

// ─── Base backdrop + card ─────────────────────────────────────────────────────

function Backdrop({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Scrim */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Card */}
      <motion.div
        className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 z-10"
        initial={{ scale: 0.92, y: 18, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.92, y: 18, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

// ─── Confirm / Delete ─────────────────────────────────────────────────────────

export function ConfirmModal({
  open,
  icon,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  icon?: string;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <Backdrop onClose={onCancel}>
          {icon && <div className="text-4xl mb-3">{icon}</div>}
          <div className="font-display font-bold text-xl mb-1">{title}</div>
          <div className="text-dojo-muted text-sm mb-6">{message}</div>
          <div className="flex gap-3 justify-end">
            <button
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              className={`px-4 py-2 rounded-xl text-sm font-semibold text-white transition ${
                danger
                  ? 'bg-dojo-danger hover:bg-red-600'
                  : 'bg-dojo-primary hover:bg-violet-700'
              }`}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </Backdrop>
      )}
    </AnimatePresence>
  );
}

// ─── Adjust Points ────────────────────────────────────────────────────────────

export function AdjustModal({
  open,
  childName,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  childName: string;
  onConfirm: (delta: number, reason: string) => void;
  onCancel: () => void;
}) {
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');

  // Reset fields whenever the modal opens
  useEffect(() => {
    if (open) { setDelta(''); setReason(''); }
  }, [open]);

  const parsed = Number(delta);
  const valid = delta.trim() !== '' && Number.isFinite(parsed) && parsed !== 0;

  function submit() {
    if (!valid) return;
    onConfirm(parsed, reason.trim() || 'Manual adjustment');
  }

  const positive = parsed > 0;

  return (
    <AnimatePresence>
      {open && (
        <Backdrop onClose={onCancel}>
          <div className="text-4xl mb-3">✏️</div>
          <div className="font-display font-bold text-xl mb-1">Adjust points</div>
          <div className="text-dojo-muted text-sm mb-5">
            Add or subtract points for <span className="font-semibold text-slate-700">{childName}</span>.
            Use a negative number to deduct.
          </div>
          <div className="space-y-3">
            <div className="relative">
              <input
                className="dojo-input w-full pr-16"
                type="number"
                placeholder="e.g. 10 or −10"
                value={delta}
                onChange={(e) => setDelta(e.target.value)}
                autoFocus
              />
              {delta.trim() !== '' && Number.isFinite(parsed) && parsed !== 0 && (
                <span
                  className={`absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold tabular-nums ${
                    positive ? 'text-dojo-success' : 'text-dojo-danger'
                  }`}
                >
                  {positive ? `+${parsed}` : parsed}
                </span>
              )}
            </div>
            <input
              className="dojo-input w-full"
              placeholder="Reason (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>
          <div className="flex gap-3 justify-end mt-5">
            <button
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              disabled={!valid}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-dojo-primary hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
              onClick={submit}
            >
              Apply
            </button>
          </div>
        </Backdrop>
      )}
    </AnimatePresence>
  );
}

// ─── Assign Consequences ──────────────────────────────────────────────────────

const DURATION_OPTIONS = [
  { label: '1 Day',        days: 1  },
  { label: '2 Days',       days: 2  },
  { label: '3 Days',       days: 3  },
  { label: '1 Week',       days: 7  },
  { label: 'Until resolved', days: 0 },
];

export function AssignConsequenceModal({
  open,
  child,
  consequences,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  child: Child | null;
  consequences: Consequence[];
  onConfirm: (selections: Array<{ consequenceId: number; durationDays: number; note: string }>) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [durationDays, setDurationDays] = useState(1);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) { setSelected(new Set()); setDurationDays(1); setNote(''); }
  }, [open]);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function submit() {
    if (selected.size === 0) return;
    onConfirm(
      [...selected].map((consequenceId) => ({ consequenceId, durationDays, note: note.trim() }))
    );
  }

  if (!child) return null;

  return (
    <AnimatePresence>
      {open && (
        <Backdrop onClose={onCancel}>
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-4xl">{child.avatar_emoji}</span>
            <div>
              <div className="font-display font-bold text-xl leading-tight">
                Assign consequences
              </div>
              <div className="text-sm text-dojo-muted">for {child.name}</div>
            </div>
          </div>

          {/* Consequences checklist */}
          <div className="text-xs font-bold text-dojo-muted uppercase tracking-wide mb-2">
            Select consequences to assign
          </div>
          {consequences.length === 0 ? (
            <div className="text-sm text-dojo-muted py-3">
              No consequences in your library yet. Add some in the Consequences tab first.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto mb-4">
              {consequences.map((c) => {
                const checked = selected.has(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggle(c.id)}
                    className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl border text-left transition ${
                      checked
                        ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-700'
                        : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                    }`}
                  >
                    <span className="text-xl shrink-0 mt-0.5">{c.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className={`font-semibold text-sm ${checked ? 'text-dojo-danger' : ''}`}>
                        {c.name}
                      </div>
                      {c.description && (
                        <div className="text-xs text-dojo-muted truncate">{c.description}</div>
                      )}
                    </div>
                    <div
                      className={`w-5 h-5 rounded-md border-2 shrink-0 mt-0.5 flex items-center justify-center transition ${
                        checked ? 'bg-dojo-danger border-dojo-danger' : 'border-slate-300'
                      }`}
                    >
                      {checked && <span className="text-white text-xs font-bold">✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Duration picker */}
          <div className="text-xs font-bold text-dojo-muted uppercase tracking-wide mb-2">
            Duration
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.days}
                onClick={() => setDurationDays(opt.days)}
                className={`px-3 py-1.5 rounded-xl border text-sm font-medium transition ${
                  durationDays === opt.days
                    ? 'bg-dojo-primary text-white border-dojo-primary'
                    : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 hover:border-dojo-primary/40'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Note */}
          <input
            className="dojo-input w-full mb-4"
            placeholder="Optional note (e.g. 'Talk again Friday')"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              disabled={selected.size === 0}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-dojo-danger hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
              onClick={submit}
            >
              Assign {selected.size > 0 ? `${selected.size} consequence${selected.size > 1 ? 's' : ''}` : ''}
            </button>
          </div>
        </Backdrop>
      )}
    </AnimatePresence>
  );
}

// ─── Redeem Reward ────────────────────────────────────────────────────────────

export function RedeemModal({
  open,
  rewardName,
  rewardIcon,
  rewardCost,
  children,
  balances,
  blockedChildIds,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  rewardName: string;
  rewardIcon: string;
  rewardCost: number;
  children: Child[];
  balances: Record<number, number>;
  /** Child IDs that currently have at least one active consequence */
  blockedChildIds: Set<number>;
  onConfirm: (childId: number) => void;
  onCancel: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <Backdrop onClose={onCancel}>
          <div className="flex items-center gap-3 mb-4">
            <div className="text-4xl">{rewardIcon}</div>
            <div>
              <div className="font-display font-bold text-xl leading-tight">{rewardName}</div>
              <div className="text-sm text-dojo-muted">{rewardCost} points</div>
            </div>
          </div>
          <div className="text-sm font-semibold text-dojo-muted uppercase tracking-wide mb-2">
            Who is redeeming this?
          </div>
          {children.length === 0 ? (
            <div className="text-dojo-muted text-sm py-3">No children added yet.</div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {children.map((c) => {
                const bal             = balances[c.id] ?? 0;
                const MIN_REDEEM      = 100;
                const hasConsequence  = blockedChildIds.has(c.id);
                const meetsMinimum    = bal >= MIN_REDEEM;
                const canAfford       = meetsMinimum && bal >= rewardCost;
                const isDisabled      = hasConsequence || !canAfford;

                const disabledReason = hasConsequence
                  ? 'Has active consequence — lift it first'
                  : !meetsMinimum
                  ? `Needs ${MIN_REDEEM}+ pts to redeem`
                  : `Not enough pts (need ${rewardCost})`;

                return (
                  <button
                    key={c.id}
                    disabled={isDisabled}
                    onClick={() => onConfirm(c.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition text-left ${
                      isDisabled
                        ? 'border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 opacity-60 cursor-not-allowed'
                        : 'border-slate-200 dark:border-slate-600 hover:border-dojo-primary hover:bg-violet-50 dark:hover:bg-violet-950/30 cursor-pointer'
                    }`}
                  >
                    <span className="text-3xl">{c.avatar_emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{c.name}</div>
                      <div className={`text-xs mt-0.5 ${hasConsequence ? 'text-dojo-danger font-medium' : 'text-dojo-muted'}`}>
                        {bal} pts
                        {!isDisabled
                          ? ` → ${bal - rewardCost} after`
                          : ` — ${disabledReason}`}
                      </div>
                    </div>
                    {hasConsequence ? (
                      <span className="text-lg shrink-0" title="Active consequence">⚠️</span>
                    ) : !isDisabled ? (
                      <span className="text-dojo-primary text-sm font-bold shrink-0">Redeem →</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}

          {/* Explanation when at least one child is blocked by a consequence */}
          {blockedChildIds.size > 0 && (
            <div className="mt-3 flex items-start gap-2 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-800 rounded-xl px-3 py-2.5 text-xs text-red-600 dark:text-red-400">
              <span className="shrink-0 text-base">⚠️</span>
              <span>
                Children with active consequences cannot redeem rewards.
                Go to the <strong>Consequences</strong> tab to resolve them first.
              </span>
            </div>
          )}

          <div className="flex justify-end mt-4">
            <button
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        </Backdrop>
      )}
    </AnimatePresence>
  );
}

// ─── Edit Child ───────────────────────────────────────────────────────────────

const CHILD_AVATARS = ['🥋','⭐','🦄','🐯','🦊','🐼','🐸','🚀','🦖','🎸','🐵','🐶','🐱','🦁','🐨','🦊','🦋','🐙','🦕','🎠'];

const THEME_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f97316',
  '#f59e0b', '#10b981', '#06b6d4', '#3b82f6',
  '#ef4444', '#84cc16',
];

export function EditChildModal({
  open,
  child,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  child: Child | null;
  onConfirm: (patch: { name: string; avatarEmoji: string; goalPoints: number; consequenceThreshold: number; notes: string; themeColor: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName]           = useState('');
  const [emoji, setEmoji]         = useState('🥋');
  const [goal, setGoal]           = useState(100);
  const [threshold, setThreshold] = useState(0);
  const [notes, setNotes]         = useState('');
  const [themeColor, setThemeColor] = useState('#6366f1');

  useEffect(() => {
    if (open && child) {
      setName(child.name);
      setEmoji(child.avatar_emoji);
      setGoal(child.goal_points);
      setThreshold(child.consequence_threshold);
      setNotes(child.notes ?? '');
      setThemeColor(child.theme_color ?? '#6366f1');
    }
  }, [open, child]);

  function submit() {
    if (!name.trim()) return;
    onConfirm({ name: name.trim(), avatarEmoji: emoji, goalPoints: goal, consequenceThreshold: threshold, notes, themeColor });
  }

  if (!child) return null;

  return (
    <AnimatePresence>
      {open && (
        <Backdrop onClose={onCancel}>
          <div className="text-4xl mb-3">{emoji}</div>
          <div className="font-display font-bold text-xl mb-4">Edit {child.name}</div>
          <div className="space-y-3">
            <input className="dojo-input w-full" placeholder="Name" value={name}
              onChange={(e) => setName(e.target.value)} autoFocus />
            <div>
              <label className="block text-xs font-semibold text-dojo-muted mb-1 uppercase tracking-wide">Avatar</label>
              <div className="flex flex-wrap gap-1.5">
                {CHILD_AVATARS.map((a) => (
                  <button key={a} type="button"
                    onClick={() => setEmoji(a)}
                    className={`text-2xl w-10 h-10 rounded-xl border-2 transition flex items-center justify-center ${
                      emoji === a ? 'border-dojo-primary bg-violet-50 dark:bg-violet-950/30' : 'border-transparent hover:border-slate-200'
                    }`}>{a}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-dojo-muted mb-1 uppercase tracking-wide">Theme colour</label>
              <div className="flex flex-wrap gap-2">
                {THEME_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setThemeColor(c)}
                    title={c}
                    className={`w-8 h-8 rounded-full border-4 transition ${themeColor === c ? 'border-slate-800 dark:border-white scale-110' : 'border-transparent hover:scale-105'}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-dojo-muted mb-1 uppercase tracking-wide">Goal points</label>
                <input type="number" className="dojo-input w-full" min={10} value={goal}
                  onChange={(e) => setGoal(Number(e.target.value))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-dojo-muted mb-1 uppercase tracking-wide">Threshold (0 = off)</label>
                <input type="number" className="dojo-input w-full" min={0} value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-dojo-muted mb-1 uppercase tracking-wide">Parent notes</label>
              <textarea
                className="dojo-input w-full resize-none"
                rows={2}
                placeholder="Private notes about this child (not visible to child)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-3 justify-end mt-5">
            <button className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              onClick={onCancel}>Cancel</button>
            <button disabled={!name.trim() || goal < 10}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-dojo-primary hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
              onClick={submit}>Save changes</button>
          </div>
        </Backdrop>
      )}
    </AnimatePresence>
  );
}

// ─── Edit Reward ──────────────────────────────────────────────────────────────

export function EditRewardModal({
  open,
  reward,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  reward: Reward | null;
  onConfirm: (patch: { name: string; cost: number; icon: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [cost, setCost] = useState(50);
  const [icon, setIcon] = useState('🎁');

  useEffect(() => {
    if (open && reward) { setName(reward.name); setCost(reward.cost); setIcon(reward.icon); }
  }, [open, reward]);

  if (!reward) return null;

  return (
    <AnimatePresence>
      {open && (
        <Backdrop onClose={onCancel}>
          <div className="text-4xl mb-3">{icon}</div>
          <div className="font-display font-bold text-xl mb-4">Edit reward</div>
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-3">
              <input className="dojo-input md:col-span-3 col-span-3" placeholder="Reward name" value={name}
                onChange={(e) => setName(e.target.value)} autoFocus />
              <input className="dojo-input" placeholder="🎁" value={icon} maxLength={4}
                onChange={(e) => setIcon(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-dojo-muted mb-1 uppercase tracking-wide">Cost in points</label>
              <input type="number" className="dojo-input w-full" min={1} value={cost}
                onChange={(e) => setCost(Number(e.target.value))} />
            </div>
          </div>
          <div className="flex gap-3 justify-end mt-5">
            <button className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              onClick={onCancel}>Cancel</button>
            <button disabled={!name.trim() || cost < 1}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-dojo-primary hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
              onClick={() => onConfirm({ name: name.trim(), cost, icon: icon || '🎁' })}>Save changes</button>
          </div>
        </Backdrop>
      )}
    </AnimatePresence>
  );
}

// ─── Edit Consequence ─────────────────────────────────────────────────────────

export function EditConsequenceModal({
  open,
  consequence,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  consequence: Consequence | null;
  onConfirm: (patch: { name: string; icon: string; description: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName]   = useState('');
  const [icon, setIcon]   = useState('⚠️');
  const [desc, setDesc]   = useState('');

  useEffect(() => {
    if (open && consequence) {
      setName(consequence.name);
      setIcon(consequence.icon);
      setDesc(consequence.description);
    }
  }, [open, consequence]);

  if (!consequence) return null;

  return (
    <AnimatePresence>
      {open && (
        <Backdrop onClose={onCancel}>
          <div className="text-4xl mb-3">{icon}</div>
          <div className="font-display font-bold text-xl mb-4">Edit consequence</div>
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-3">
              <input className="dojo-input" placeholder="⚠️" value={icon} maxLength={4}
                onChange={(e) => setIcon(e.target.value)} />
              <input className="dojo-input col-span-3" placeholder="Name" value={name}
                onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div>
              <label className="block text-xs font-semibold text-dojo-muted mb-1 uppercase tracking-wide">Description (optional)</label>
              <input className="dojo-input w-full" placeholder="e.g. No screens until resolved"
                value={desc} onChange={(e) => setDesc(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-3 justify-end mt-5">
            <button className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              onClick={onCancel}>Cancel</button>
            <button disabled={!name.trim()}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-dojo-primary hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
              onClick={() => onConfirm({ name: name.trim(), icon: icon || '⚠️', description: desc.trim() })}>Save changes</button>
          </div>
        </Backdrop>
      )}
    </AnimatePresence>
  );
}
