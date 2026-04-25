import { useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../store';
import type { AssignedConsequence, Behaviour, Child, Reward } from '../types';
import { DojoCoachCard } from './DojoCoachCard';

const MIN_REDEEM = 100;

// ── Web Audio sound effects ────────────────────────────────────────────────────

function playSound(kind: 'positive' | 'negative') {
  try {
    const ctx = new AudioContext();
    const g = ctx.createGain();
    g.connect(ctx.destination);

    if (kind === 'positive') {
      // Two cheerful ascending tones
      [[523, 0], [659, 0.12], [784, 0.24]].forEach(([freq, delay]) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq as number;
        osc.connect(g);
        g.gain.setValueAtTime(0.18, ctx.currentTime + (delay as number));
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (delay as number) + 0.22);
        osc.start(ctx.currentTime + (delay as number));
        osc.stop(ctx.currentTime + (delay as number) + 0.23);
      });
    } else {
      // Descending minor tone
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(330, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.35);
      osc.connect(g);
      g.gain.setValueAtTime(0.18, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    }
    setTimeout(() => ctx.close(), 600);
  } catch {
    // AudioContext not available — silently skip
  }
}

// ── PIN entry screen ───────────────────────────────────────────────────────────

const PIN_ATTEMPTS_KEY = 'dojo_pin_attempts';
const PIN_LOCKOUT_KEY  = 'dojo_pin_lockout';
const MAX_ATTEMPTS     = 5;
const LOCKOUT_MS       = 10 * 60 * 1000; // 10 minutes

function getPinAttempts(): number {
  try { return parseInt(localStorage.getItem(PIN_ATTEMPTS_KEY) ?? '0', 10); } catch { return 0; }
}
function setPinAttempts(n: number) {
  try { localStorage.setItem(PIN_ATTEMPTS_KEY, String(n)); } catch { /* ignore */ }
}
function getLockoutUntil(): number {
  try { return parseInt(localStorage.getItem(PIN_LOCKOUT_KEY) ?? '0', 10); } catch { return 0; }
}
function setLockoutUntil(ts: number) {
  try { localStorage.setItem(PIN_LOCKOUT_KEY, String(ts)); } catch { /* ignore */ }
}
function clearPinLockout() {
  try { localStorage.removeItem(PIN_ATTEMPTS_KEY); localStorage.removeItem(PIN_LOCKOUT_KEY); } catch { /* ignore */ }
}

function KidPinEntry({ onVerified }: { onVerified: () => void }) {
  const [digits, setDigits]       = useState('');
  const [error, setError]         = useState(false);
  const [shake, setShake]         = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number>(() => getLockoutUntil());

  // Countdown display
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (lockedUntil <= Date.now()) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [lockedUntil]);

  async function handleDigit(d: string) {
    if (lockedUntil > Date.now()) return; // locked — ignore taps
    if (digits.length >= 4) return;
    const next = digits + d;
    setDigits(next);
    if (next.length === 4) {
      const ok = await window.dojo.verifyKidPin(next);
      if (ok) {
        clearPinLockout();
        onVerified();
      } else {
        const attempts = getPinAttempts() + 1;
        setPinAttempts(attempts);
        if (attempts >= MAX_ATTEMPTS) {
          const until = Date.now() + LOCKOUT_MS;
          setLockoutUntil(until);
          setLockedUntil(until);
          setPinAttempts(0);
        }
        setError(true);
        setShake(true);
        setTimeout(() => { setDigits(''); setError(false); setShake(false); }, 600);
      }
    }
  }

  const secsLeft = Math.ceil((lockedUntil - now) / 1000);

  const isLocked = lockedUntil > now;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800">
      <div className="w-full max-w-xs">
        <div className="text-center mb-6">
          <div className="text-6xl mb-3">{isLocked ? '🔒' : '🔐'}</div>
          <div className="font-display text-2xl font-bold">
            {isLocked ? 'Too many attempts' : 'Enter your PIN'}
          </div>
          <div className="text-dojo-muted text-sm mt-1">
            {isLocked
              ? `Try again in ${Math.floor(secsLeft / 60)}:${String(secsLeft % 60).padStart(2, '0')}`
              : 'Ask a parent if you forgot it'}
          </div>
        </div>

        {!isLocked && (
          <>
            {/* Dots */}
            <motion.div
              className="flex justify-center gap-4 mb-8"
              animate={shake ? { x: [-8, 8, -8, 8, 0] } : {}}
              transition={{ duration: 0.3 }}
            >
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full border-2 transition-all ${
                    i < digits.length
                      ? error ? 'bg-red-500 border-red-500' : 'bg-dojo-primary border-dojo-primary'
                      : 'bg-transparent border-slate-300 dark:border-slate-600'
                  }`}
                />
              ))}
            </motion.div>

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-3">
              {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k) => (
                <button
                  key={k}
                  disabled={k === ''}
                  onClick={() => {
                    if (k === '⌫') setDigits((d) => d.slice(0, -1));
                    else if (k !== '') handleDigit(k);
                  }}
                  className={`h-16 rounded-2xl text-2xl font-bold transition ${
                    k === ''
                      ? 'invisible'
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-violet-50 dark:hover:bg-slate-700 active:scale-95 shadow-sm'
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>

            {error && (
              <div className="mt-4 text-center text-sm text-red-600 font-semibold">
                Wrong PIN — {MAX_ATTEMPTS - getPinAttempts()} attempt{MAX_ATTEMPTS - getPinAttempts() === 1 ? '' : 's'} left
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Expiry helper (shown on the kid screen) ───────────────────────────────────

function expiryLabel(ac: AssignedConsequence): string {
  if (ac.duration_days === 0 || !ac.expires_at) return 'Until resolved by parent';
  const msLeft = new Date(ac.expires_at).getTime() - Date.now();
  if (msLeft <= 0) return 'Expiring soon';
  const hours = Math.floor(msLeft / 3_600_000);
  if (hours < 24) return `${hours}h remaining`;
  const days = Math.ceil(msLeft / 86_400_000);
  return `${days} day${days === 1 ? '' : 's'} remaining`;
}

// ── Main component ────────────────────────────────────────────────────────────

export function KidView() {
  const children        = useApp((s) => s.children);
  const behaviours      = useApp((s) => s.behaviours);
  const rewards           = useApp((s) => s.rewards);
  const requireApproval   = useApp((s) => s.requireApproval);
  const pendingCount      = useApp((s) => s.pendingCount);
  const refreshPendingCount = useApp((s) => s.refreshPendingCount);
  const activeChildId     = useApp((s) => s.activeChildId);
  const setActiveChild    = useApp((s) => s.setActiveChild);
  const goParent          = useApp((s) => s.goParent);
  const darkMode          = useApp((s) => s.darkMode);
  const toggleDarkMode    = useApp((s) => s.toggleDarkMode);

  // ── PIN gate ──
  const [pinRequired, setPinRequired]   = useState(false);
  const [pinVerified, setPinVerified]   = useState(false);

  useEffect(() => {
    window.dojo.hasKidPin().then((has) => {
      if (has) { setPinRequired(true); setPinVerified(false); }
      else     { setPinRequired(false); setPinVerified(true); }
    }).catch(() => setPinVerified(true));
  }, []);

  const [balance, setBalance]             = useState(0);
  const [streak, setStreak]               = useState(0);
  const [shopOpen, setShopOpen]           = useState(false);
  const [toast, setToast]                 = useState<{ id: number; text: string; kind: 'positive' | 'negative' | 'pending' } | null>(null);
  const [trophy, setTrophy]               = useState(false);
  const [consequenceOverlay, setConsequenceOverlay] = useState(false);
  const [assignedConsequences, setAssignedConsequences] = useState<AssignedConsequence[]>([]);
  const [excludedBehaviourIds, setExcludedBehaviourIds] = useState<number[]>([]);

  // Undo last tap
  const [undoHistoryId, setUndoHistoryId] = useState<number | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Category filter
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const activeChild: Child | undefined = useMemo(
    () => children.find((c) => c.id === activeChildId),
    [children, activeChildId]
  );

  // Load balance and assigned consequences separately so one failure can't block the other
  useEffect(() => {
    let cancelled = false;
    if (!activeChildId) return;

    // Clear any pending undo when switching children
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoHistoryId(null);
    setActiveCategory(null);

    // Balance — always needed, load first
    window.dojo.getChildPoints(activeChildId)
      .then((b) => { if (!cancelled) setBalance(b); })
      .catch(() => {});

    // Streak — load independently; fail gracefully
    window.dojo.getStreak(activeChildId)
      .then((s) => { if (!cancelled) setStreak(s); })
      .catch(() => { if (!cancelled) setStreak(0); });

    // Assigned consequences — load independently; fail gracefully
    window.dojo.getActiveConsequencesForChild(activeChildId)
      .then((ac) => { if (!cancelled) setAssignedConsequences(ac); })
      .catch(() => { if (!cancelled) setAssignedConsequences([]); });

    // Per-child excluded behaviour IDs
    window.dojo.listBehaviourExcludes(activeChildId)
      .then((ids) => { if (!cancelled) setExcludedBehaviourIds(ids); })
      .catch(() => { if (!cancelled) setExcludedBehaviourIds([]); });

    return () => { cancelled = true; };
  }, [activeChildId]);

  // Helper to refresh streak + consequences after a tap (non-blocking)
  function refreshAfterTap() {
    if (!activeChildId) return;
    window.dojo.getStreak(activeChildId)
      .then((s) => setStreak(s))
      .catch(() => {});
    window.dojo.getActiveConsequencesForChild(activeChildId)
      .then((ac) => setAssignedConsequences(ac))
      .catch(() => {});
  }

  async function tap(b: Behaviour) {
    if (!activeChildId) return;

    // ── Approval-required mode: queue the tap instead of applying ──
    if (requireApproval) {
      await window.dojo.addPending({ childId: activeChildId, behaviourId: b.id });
      refreshPendingCount();
      const id = Date.now();
      setToast({ id, text: `✋ Sent for parent approval`, kind: 'pending' });
      setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 1800);
      return;
    }

    // ── Normal mode: apply immediately ──
    const res = await window.dojo.applyBehaviour({ childId: activeChildId, behaviourId: b.id });

    // Daily limit or cap reached — no points applied
    if (res.capped) {
      const id = Date.now();
      setToast({ id, text: `⛔ Daily limit reached for "${b.name}"`, kind: 'pending' });
      setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 2400);
      return;
    }

    setBalance(res.balance);
    refreshAfterTap();

    // Sound effect
    playSound(b.kind === 'positive' ? 'positive' : 'negative');

    // Set up undo window (5 seconds)
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoHistoryId(res.historyId);
    undoTimerRef.current = setTimeout(() => {
      setUndoHistoryId(null);
      undoTimerRef.current = null;
    }, 5000);

    const id = Date.now();
    setToast({
      id,
      text: `${b.kind === 'positive' ? '+' : ''}${b.points} — ${b.name}`,
      kind: b.kind === 'positive' ? 'positive' : 'negative',
    });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 4800);

    if (b.kind === 'positive') {
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.7 } });
    }

    if (res.milestone) {
      setTrophy(true);
      confetti({ particleCount: 250, spread: 120, origin: { y: 0.6 }, startVelocity: 45 });
      setTimeout(() => confetti({ particleCount: 150, angle: 60,  spread: 55, origin: { x: 0 } }), 200);
      setTimeout(() => confetti({ particleCount: 150, angle: 120, spread: 55, origin: { x: 1 } }), 400);
      setTimeout(() => setTrophy(false), 3200);
    }

    if (res.consequenceTriggered) {
      setConsequenceOverlay(true);
    }
  }

  async function handleUndo() {
    if (!undoHistoryId || !activeChildId) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoHistoryId(null);
    setToast(null);
    try {
      const res = await window.dojo.undoHistory(undoHistoryId);
      setBalance(res.balance ?? 0);
      refreshAfterTap();
      const id = Date.now();
      setToast({ id, text: '↩️ Tap undone', kind: 'pending' });
      setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 1800);
    } catch {
      // ignore — entry may already be gone
    }
  }

  // Show PIN entry if required and not yet verified
  if (pinRequired && !pinVerified) {
    return <KidPinEntry onVerified={() => setPinVerified(true)} />;
  }

  if (!activeChild) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="dojo-card text-center max-w-md">
          <div className="text-5xl mb-3">👋</div>
          <div className="font-display text-xl font-bold mb-2">No children yet</div>
          <div className="text-dojo-muted mb-5">Head into the parent portal to add your first child.</div>
          <button className="dojo-btn-primary" onClick={() => goParent('children')}>
            Open parent portal
          </button>
        </div>
      </div>
    );
  }

  const goal             = activeChild.goal_points;
  const threshold        = activeChild.consequence_threshold;
  const pct              = Math.max(0, Math.min(100, Math.round(((balance % goal) / goal) * 100)));
  const milestonesEarned = Math.floor(balance / goal);
  const isInConsequence  = threshold > 0 && balance <= threshold;
  const thresholdPct     = threshold > 0 ? Math.min(100, Math.round((threshold / goal) * 100)) : null;
  const themeColor       = activeChild.theme_color || '#6366f1';

  const positives = behaviours.filter((b) => b.kind === 'positive' && !excludedBehaviourIds.includes(b.id));
  const negatives = behaviours.filter((b) => b.kind === 'negative' && !excludedBehaviourIds.includes(b.id));

  // Derive unique categories across all visible behaviours (for filter chips)
  const allCategories = Array.from(
    new Set([...positives, ...negatives].map((b) => b.category).filter(Boolean))
  ).sort();
  const filteredPositives = activeCategory ? positives.filter((b) => b.category === activeCategory) : positives;
  const filteredNegatives = activeCategory ? negatives.filter((b) => b.category === activeCategory) : negatives;

  return (
    <div className="min-h-screen">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between p-5">
        <div className="flex gap-2 overflow-auto">
          {children.map((c) => (
            <button
              key={c.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-2xl border transition ${
                c.id === activeChild.id
                  ? 'bg-white dark:bg-slate-800 border-dojo-primary shadow-dojo'
                  : 'bg-white/70 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 hover:border-dojo-primary/50'
              }`}
              onClick={() => setActiveChild(c.id)}
            >
              <span className="text-2xl">{c.avatar_emoji}</span>
              <span className="font-semibold">{c.name}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            className="dojo-btn-ghost"
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={toggleDarkMode}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
          <button className="dojo-btn-ghost" onClick={() => goParent('children')}>
            🔒 Parent
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6">
        {/* ── Approval-mode notice ── */}
        {requireApproval && (
          <div className="mb-4 flex items-center gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 rounded-2xl px-4 py-3">
            <span className="text-2xl shrink-0">✋</span>
            <div className="flex-1">
              <div className="font-semibold text-sm text-amber-800 dark:text-amber-300">
                Parent approval required
              </div>
              <div className="text-xs text-amber-700 dark:text-amber-400">
                Tapping a behaviour sends it to a parent for review before points are added.
                {pendingCount > 0 && (
                  <span className="ml-1 font-bold">
                    {pendingCount} submission{pendingCount === 1 ? '' : 's'} waiting.
                  </span>
                )}
              </div>
            </div>
            {pendingCount > 0 && (
              <div className="shrink-0 bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                {pendingCount}
              </div>
            )}
          </div>
        )}

        {/* ── Hero progress card ── */}
        <div className="dojo-card relative overflow-hidden">
          <div className="flex items-center gap-4">
            <div className="text-7xl">{activeChild.avatar_emoji}</div>
            <div className="flex-1">
              <div className="font-display text-3xl font-bold">{activeChild.name}'s Dojo</div>
              <div className="text-dojo-muted">
                {milestonesEarned > 0 && (
                  <span className="mr-2">🏆 {milestonesEarned} trophy{milestonesEarned === 1 ? '' : 's'}</span>
                )}
                Goal: {goal} points
                {threshold > 0 && <span className="ml-3 text-dojo-danger text-sm">· Threshold: {threshold}</span>}
              </div>
              {/* Streak badge */}
              {streak > 0 && (
                <div className={`inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-sm font-bold border ${
                  streak >= 7
                    ? 'bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300'
                    : 'bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400'
                }`}>
                  🔥 {streak} day{streak === 1 ? '' : 's'} in a row!
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-sm text-dojo-muted">Points</div>
              <div
                className={`font-display text-5xl font-bold tabular-nums ${isInConsequence ? 'text-dojo-danger' : ''}`}
                style={isInConsequence ? {} : { color: themeColor }}
              >
                {balance}
              </div>
            </div>
          </div>

          {/* Consequence alert banner */}
          {isInConsequence && (
            <div className="mt-4 flex items-center gap-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <div className="font-bold text-dojo-danger text-sm">Needs attention</div>
                <div className="text-xs text-red-600">
                  Balance ({balance}) is at or below the threshold ({threshold}).
                  Keep earning points to lift your consequences!
                </div>
              </div>
            </div>
          )}

          {/* Progress bar */}
          <div className="mt-6">
            <div className="flex justify-between text-xs font-semibold text-dojo-muted mb-1">
              <span>Progress to next trophy</span>
              <span>{pct}%</span>
            </div>
            <div className="relative h-5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-visible">
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(to right, ${themeColor}, ${themeColor}cc)` }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ type: 'spring', stiffness: 80, damping: 16 }}
              />
              {thresholdPct !== null && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-dojo-danger z-10"
                  style={{ left: `${thresholdPct}%` }}
                  title={`Threshold: ${threshold}`}
                >
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs text-dojo-danger font-bold whitespace-nowrap">
                    ▼
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Dojo Coach Card (AI daily message) ── */}
        {activeChild && activeChildId && (
          <DojoCoachCard
            childId={activeChildId}
            childName={activeChild.name}
            points={balance}
            goal={activeChild.goal_points}
            streak={streak}
            themeColor={activeChild.theme_color ?? '#6366f1'}
          />
        )}

        {/* ── Active assigned consequences card ── */}
        {assignedConsequences.length > 0 && (
          <div className="dojo-card mt-4 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">⚠️</span>
              <div className="font-display font-semibold text-dojo-danger">
                Current consequences ({assignedConsequences.length})
              </div>
            </div>
            <div className="space-y-2">
              {assignedConsequences.map((ac) => (
                <div
                  key={ac.id}
                  className="flex items-start gap-3 bg-white dark:bg-slate-800 border border-red-100 dark:border-red-900/50 rounded-xl px-3 py-2.5"
                >
                  <span className="text-xl shrink-0">{ac.consequence_icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-dojo-danger">{ac.consequence_name}</div>
                    {ac.consequence_description && (
                      <div className="text-xs text-red-500 mt-0.5">{ac.consequence_description}</div>
                    )}
                    <div className="mt-1">
                      <span className="text-xs bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-semibold">
                        🕐 {expiryLabel(ac)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-red-400 mt-3">
              Keep earning points to work your way back above the threshold and lift your consequences.
            </p>
          </div>
        )}

        {/* ── Behaviours grid ── */}
        {/* Category filter chips — shown only when ≥1 category exists */}
        {allCategories.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-6 px-1">
            <button
              onClick={() => setActiveCategory(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                activeCategory === null
                  ? 'bg-dojo-primary text-white border-dojo-primary'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-dojo-muted hover:border-dojo-primary/50'
              }`}
            >
              All
            </button>
            {allCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                  activeCategory === cat
                    ? 'bg-dojo-primary text-white border-dojo-primary'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-dojo-muted hover:border-dojo-primary/50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
        <div className="grid md:grid-cols-2 gap-6 mt-4">
          <Section title="Ways to earn ⭐" empty="No positive behaviours yet — ask a parent to add some.">
            {filteredPositives.map((b) => (
              <TapTile key={b.id} b={b} onTap={() => tap(b)} />
            ))}
          </Section>
          <Section title="Needs Attention ⚠️" empty="Nothing needs attention yet.">
            {filteredNegatives.map((b) => (
              <TapTile key={b.id} b={b} onTap={() => tap(b)} />
            ))}
          </Section>
        </div>

        {/* ── Rewards shop ── */}
        {rewards.length > 0 && (
          <div className="dojo-card mt-6">
            {/* Header / toggle */}
            <button
              className="w-full flex items-center justify-between group"
              onClick={() => setShopOpen((o) => !o)}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">🎁</span>
                <span className="font-display font-semibold text-lg">Rewards shop</span>
                <span className="text-xs bg-violet-100 dark:bg-violet-900/50 text-dojo-primary border border-violet-200 dark:border-violet-800 px-2 py-0.5 rounded-full font-semibold">
                  {rewards.length} reward{rewards.length === 1 ? '' : 's'}
                </span>
              </div>
              <span className={`text-dojo-muted transition-transform duration-200 ${shopOpen ? 'rotate-180' : ''}`}>
                ▾
              </span>
            </button>

            <AnimatePresence initial={false}>
              {shopOpen && (
                <motion.div
                  key="shop"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 space-y-3">
                    {/* 100-pt minimum notice when below floor */}
                    {balance < MIN_REDEEM && (
                      <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 rounded-xl px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
                        <span className="text-base shrink-0">ℹ️</span>
                        <span>You need at least <strong>{MIN_REDEEM} pts</strong> to claim any reward. Keep going!</span>
                      </div>
                    )}
                    {[...rewards].sort((a, b) => a.cost - b.cost).map((r) => (
                      <RewardShopCard key={r.id} reward={r} balance={balance} />
                    ))}
                  </div>
                  <p className="text-xs text-dojo-muted mt-4">
                    Ask a parent to claim a reward for you when you have enough points.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <div className="text-center text-xs text-dojo-muted mt-8 pb-6">
          Tap a card to log it. Parents can adjust points in the parent portal.
        </div>
      </div>

      {/* ── Point toast (with Undo button while undoHistoryId is set) ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 40, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-5 py-3 rounded-2xl text-white font-bold shadow-dojo z-50 whitespace-nowrap ${
              toast.kind === 'positive' ? 'bg-dojo-success' :
              toast.kind === 'pending'  ? 'bg-amber-500'    :
              'bg-dojo-danger'
            }`}
          >
            <span>{toast.text}</span>
            {undoHistoryId && (
              <button
                className="ml-1 px-2.5 py-1 rounded-xl bg-white/20 hover:bg-white/30 text-white text-sm font-bold border border-white/30 transition"
                onClick={handleUndo}
              >
                ↩ Undo
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Trophy milestone overlay ── */}
      <AnimatePresence>
        {trophy && (
          <motion.div
            className="fixed inset-0 flex items-center justify-center bg-black/20 z-50 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.4, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 14 }}
              className="bg-white dark:bg-slate-800 rounded-3xl px-10 py-8 shadow-dojo text-center"
            >
              <div className="text-8xl">🏆</div>
              <div className="font-display text-3xl font-bold mt-2">Goal reached!</div>
              <div className="text-dojo-muted mt-1">Time for a reward 🎉</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Consequence triggered overlay ── */}
      <AnimatePresence>
        {consequenceOverlay && (
          <motion.div
            className="fixed inset-0 flex items-center justify-center bg-black/50 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConsequenceOverlay(false)}
          >
            <motion.div
              className="bg-white dark:bg-slate-800 rounded-3xl px-10 py-8 shadow-dojo text-center max-w-sm mx-4"
              initial={{ scale: 0.5, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0.5 }}
              transition={{ type: 'spring', stiffness: 220, damping: 18 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-8xl">⚠️</div>
              <div className="font-display text-2xl font-bold mt-2 text-dojo-danger">
                Consequence triggered!
              </div>
              <div className="text-dojo-muted text-sm mt-2">
                Your balance has dropped below the threshold.
                Work hard to earn your way back!
              </div>
              <button
                className="mt-5 dojo-btn-primary"
                onClick={() => setConsequenceOverlay(false)}
              >
                OK, I'll try harder!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({
  title, empty, children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const arr = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
  return (
    <div className="dojo-card">
      <div className="font-display font-semibold text-lg mb-3">{title}</div>
      {arr.length === 0 ? (
        <div className="text-dojo-muted text-sm">{empty}</div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {children}
        </div>
      )}
    </div>
  );
}

function TapTile({ b, onTap }: { b: Behaviour; onTap: () => void }) {
  const isPositive = b.kind === 'positive';
  return (
    <motion.button
      whileTap={{ scale: 0.94 }}
      onClick={onTap}
      className={`relative flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 text-center transition select-none cursor-pointer ${
        isPositive
          ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 dark:hover:border-emerald-600'
          : 'bg-red-50   dark:bg-red-950/30   border-red-200   dark:border-red-800   hover:border-red-400   dark:hover:border-red-600'
      }`}
    >
      <span className="text-4xl leading-none">{b.icon}</span>
      <span className="text-xs font-semibold leading-tight line-clamp-2">{b.name}</span>
      <span className={`text-xs font-bold tabular-nums px-2 py-0.5 rounded-full ${
        isPositive
          ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
          : 'bg-red-100   dark:bg-red-900/50   text-red-700   dark:text-red-300'
      }`}>
        {isPositive ? '+' : ''}{b.points}
      </span>
      {b.daily_limit > 0 && (
        <span className="absolute top-1.5 right-1.5 text-[10px] text-dojo-muted bg-white/80 dark:bg-slate-800/80 px-1.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-600">
          {b.daily_limit}/day
        </span>
      )}
    </motion.button>
  );
}

function RewardShopCard({ reward, balance }: { reward: Reward; balance: number }) {
  const canAfford = balance >= Math.max(MIN_REDEEM, reward.cost);
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border transition ${
      canAfford
        ? 'bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800'
        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 opacity-60'
    }`}>
      <span className="text-3xl shrink-0">{reward.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate">{reward.name}</div>

      </div>
      <div className={`shrink-0 font-bold tabular-nums text-sm px-3 py-1 rounded-xl ${
        canAfford
          ? 'bg-violet-600 text-white'
          : 'bg-slate-200 dark:bg-slate-700 text-dojo-muted'
      }`}>
        {reward.cost} pts
      </div>
    </div>
  );
}
