import { useEffect, useState } from 'react';
import { useApp } from '../store';
import type { ParentTab } from '../store';
import { ManageChildren } from './ManageChildren';
import { ManageBehaviours } from './ManageBehaviours';
import { ManageRewards } from './ManageRewards';
import { ManageConsequences } from './ManageConsequences';
import { ManageApprovals } from './ManageApprovals';
import { History } from './History';
import { Reports } from './Reports';
import { Settings } from './Settings';

const BASE_TABS: Array<{ id: ParentTab; label: string; icon: string }> = [
  { id: 'children',     label: 'Children',     icon: '👧' },
  { id: 'behaviours',   label: 'Behaviours',   icon: '⭐' },
  { id: 'rewards',      label: 'Rewards',      icon: '🎁' },
  { id: 'consequences', label: 'Consequences', icon: '⚠️' },
  { id: 'reports',      label: 'Reports',      icon: '📊' },
  { id: 'history',      label: 'History',      icon: '🗓️' },
  { id: 'settings',     label: 'Settings',     icon: '⚙️' },
];

export function ParentPortal() {
  const view             = useApp((s) => s.view);
  const setView          = useApp((s) => s.setView);
  const lockParent       = useApp((s) => s.lockParent);
  const goKid            = useApp((s) => s.goKid);
  const darkMode         = useApp((s) => s.darkMode);
  const toggleDarkMode   = useApp((s) => s.toggleDarkMode);
  const requireApproval  = useApp((s) => s.requireApproval);
  const pendingCount     = useApp((s) => s.pendingCount);
  const [showHelp, setShowHelp] = useState(false);

  if (view.name !== 'parent-portal') return null;
  const tab = view.tab;

  // Show Approvals tab only when the approval-mode setting is enabled
  const TABS = requireApproval
    ? [
        ...BASE_TABS.slice(0, 4),
        { id: 'approvals' as ParentTab, label: 'Approvals', icon: '✋' },
        ...BASE_TABS.slice(4),
      ]
    : BASE_TABS;

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────
  // 1–9: switch to nth tab; L: lock & exit; D: toggle dark mode
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Don't intercept while typing in an input / textarea / select
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const n = parseInt(e.key, 10);
      if (!isNaN(n) && n >= 1 && n <= TABS.length) {
        e.preventDefault();
        setView({ name: 'parent-portal', tab: TABS[n - 1].id });
        return;
      }
      if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        lockParent();
        goKid();
        return;
      }
      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        toggleDarkMode();
        return;
      }
      if (e.key === '?') {
        e.preventDefault();
        setShowHelp((v) => !v);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [TABS.length]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white/60 dark:bg-slate-900/70 backdrop-blur border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="text-3xl">🥋</div>
          <div>
            <div className="font-display font-bold">Parent portal</div>
            <div className="text-xs text-dojo-muted">Configure DutyDojo for your family</div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            className="dojo-btn-ghost"
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={toggleDarkMode}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
          <button
            className="dojo-btn-ghost"
            title="Keyboard shortcuts"
            onClick={() => setShowHelp((v) => !v)}
          >
            ⌨️
          </button>
          <button
            className="dojo-btn-ghost"
            onClick={() => {
              lockParent();
              goKid();
            }}
          >
            🔒 Lock & exit
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-4">
        <div className="flex gap-2 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`relative px-4 py-2 rounded-xl border font-medium transition ${
                tab === t.id
                  ? 'bg-dojo-primary text-white border-dojo-primary shadow-dojo'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-dojo-primary/40 dark:hover:border-dojo-primary/60'
              }`}
              onClick={() => setView({ name: 'parent-portal', tab: t.id })}
            >
              <span className="mr-2">{t.icon}</span>
              {t.label}
              {/* Keyboard shortcut hint */}
              <span className={`ml-1.5 text-[10px] font-mono px-1 py-0.5 rounded border ${
                tab === t.id
                  ? 'border-white/40 text-white/70'
                  : 'border-slate-200 dark:border-slate-600 text-dojo-muted'
              }`}>
                {TABS.indexOf(t) + 1}
              </span>
              {/* Badge for pending approvals */}
              {t.id === 'approvals' && pendingCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[10px] font-bold leading-none px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Keyboard shortcuts help panel ── */}
      {showHelp && (
        <div className="mx-6 mt-3 p-4 rounded-2xl border border-dojo-primary/30 bg-violet-50 dark:bg-violet-950/20 text-sm space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-dojo-primary">⌨️ Keyboard shortcuts</span>
            <button className="text-dojo-muted hover:text-slate-700 dark:hover:text-slate-300 text-lg leading-none" onClick={() => setShowHelp(false)}>×</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-1 text-xs text-dojo-muted">
            {TABS.map((t, i) => (
              <div key={t.id} className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 font-mono bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">{i + 1}</kbd>
                <span>{t.icon} {t.label}</span>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 font-mono bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">D</kbd>
              <span>Toggle dark mode</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 font-mono bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">L</kbd>
              <span>Lock & exit</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 font-mono bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">?</kbd>
              <span>Toggle this panel</span>
            </div>
          </div>
        </div>
      )}

      <div className="p-6">
        {tab === 'children'     && <ManageChildren />}
        {tab === 'behaviours'   && <ManageBehaviours />}
        {tab === 'rewards'      && <ManageRewards />}
        {tab === 'consequences' && <ManageConsequences />}
        {tab === 'approvals'    && <ManageApprovals />}
        {tab === 'reports'      && <Reports />}
        {tab === 'history'      && <History />}
        {tab === 'settings'     && <Settings />}
      </div>
    </div>
  );
}
