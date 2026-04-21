import { useEffect } from 'react';
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
