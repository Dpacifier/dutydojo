import { useEffect, useState } from 'react';
import { useApp } from '../store';
import { ConfirmModal, AdjustModal, EditChildModal } from './Modal';
import type { Child } from '../types';

const AVATARS = ['🥋', '⭐', '🦄', '🐯', '🦊', '🐼', '🐸', '🚀', '🦖', '🎸', '🐵', '🐶'];
const THEME_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f97316',
  '#f59e0b', '#10b981', '#06b6d4', '#3b82f6',
];

export function ManageChildren() {
  const children = useApp((s) => s.children);
  const refreshChildren = useApp((s) => s.refreshChildren);
  const [balances, setBalances] = useState<Record<number, number>>({});
  const [archivedChildren, setArchivedChildren] = useState<Child[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  // Add-child form state
  const [name, setName]           = useState('');
  const [emoji, setEmoji]         = useState('🥋');
  const [goal, setGoal]           = useState(100);
  const [threshold, setThreshold] = useState(0);
  const [startPts, setStartPts]   = useState(0);
  const [themeColor, setThemeColor] = useState('#6366f1');

  // Modal state
  const [archiveTarget, setArchiveTarget] = useState<{ id: number; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget]   = useState<{ id: number; name: string } | null>(null);
  const [adjustTarget, setAdjustTarget]   = useState<{ id: number; name: string } | null>(null);
  const [editTarget, setEditTarget]       = useState<Child | null>(null);

  // Load defaults from parent settings on mount
  useEffect(() => {
    (async () => {
      const s = await window.dojo.getSettings();
      setGoal(s.default_goal_points);
      setThreshold(s.default_threshold);
      setStartPts(s.default_start_points);
    })();
  }, []);

  // Refresh balances whenever children change; also load archived
  useEffect(() => {
    (async () => {
      const allKids = await window.dojo.listAllChildren();
      const archived = allKids.filter((c) => c.archived);
      setArchivedChildren(archived);

      if (children.length === 0) return;
      const pairs = await Promise.all(
        children.map(async (c) => [c.id, await window.dojo.getChildPoints(c.id)] as const)
      );
      setBalances(Object.fromEntries(pairs));
    })();
  }, [children]);

  async function add() {
    if (!name.trim()) return;
    await window.dojo.addChild({
      name: name.trim(),
      avatarEmoji: emoji,
      goalPoints: goal,
      consequenceThreshold: threshold,
      initialPoints: startPts > 0 ? startPts : undefined,
      themeColor,
    });
    setName('');
    setEmoji('🥋');
    setThemeColor('#6366f1');
    await refreshChildren();
  }

  async function confirmArchive() {
    if (!archiveTarget) return;
    await window.dojo.archiveChild(archiveTarget.id);
    setArchiveTarget(null);
    await refreshChildren();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await window.dojo.deleteChild(deleteTarget.id);
    setDeleteTarget(null);
    await refreshChildren();
  }

  async function unarchive(id: number) {
    await window.dojo.unarchiveChild(id);
    await refreshChildren();
  }

  async function confirmAdjust(delta: number, reason: string) {
    if (!adjustTarget) return;
    await window.dojo.manualAdjust({ childId: adjustTarget.id, delta, reason });
    const b = await window.dojo.getChildPoints(adjustTarget.id);
    setBalances((s) => ({ ...s, [adjustTarget.id]: b }));
    setAdjustTarget(null);
  }

  async function confirmEdit(patch: { name: string; avatarEmoji: string; goalPoints: number; consequenceThreshold: number; notes: string; themeColor: string }) {
    if (!editTarget) return;
    await window.dojo.updateChild({
      id: editTarget.id,
      name: patch.name,
      avatarEmoji: patch.avatarEmoji,
      goalPoints: patch.goalPoints,
      consequenceThreshold: patch.consequenceThreshold,
      notes: patch.notes,
      themeColor: patch.themeColor,
    });
    setEditTarget(null);
    await refreshChildren();
  }

  return (
    <div className="space-y-6">
      {/* ── Add child form ── */}
      <div className="dojo-card">
        <div className="font-display font-semibold text-lg mb-3">Add a child</div>
        <div className="grid md:grid-cols-3 gap-3">
          <input
            className="dojo-input md:col-span-1"
            placeholder="Name"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
          />
          <select
            className="dojo-input"
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
          >
            {AVATARS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <input
            type="number"
            className="dojo-input"
            placeholder="Goal points"
            value={goal}
            min={10}
            onChange={(e) => setGoal(Number(e.target.value))}
          />
        </div>
        <div className="grid md:grid-cols-2 gap-3 mt-3">
          <div>
            <label className="block text-xs font-semibold text-dojo-muted mb-1">
              Starting points
            </label>
            <input
              type="number"
              className="dojo-input w-full"
              placeholder="e.g. 100"
              value={startPts}
              min={0}
              onChange={(e) => setStartPts(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-dojo-muted mb-1">
              Consequence threshold <span className="font-normal">(0 = off)</span>
            </label>
            <input
              type="number"
              className="dojo-input w-full"
              placeholder="e.g. 50 (0 = off)"
              value={threshold}
              min={0}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
          </div>
        </div>
        {/* Theme colour picker */}
        <div className="mt-3">
          <label className="block text-xs font-semibold text-dojo-muted mb-2">Theme colour</label>
          <div className="flex gap-2 flex-wrap">
            {THEME_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setThemeColor(c)}
                className={`w-8 h-8 rounded-full border-4 transition ${themeColor === c ? 'border-slate-800 dark:border-white scale-110' : 'border-transparent hover:scale-105'}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        <div className="mt-3">
          <button className="dojo-btn-primary" onClick={add}>
            Add child
          </button>
        </div>
      </div>

      {/* ── Active children list ── */}
      <div className="dojo-card">
        <div className="font-display font-semibold text-lg mb-3">
          Children ({children.length})
        </div>
        {children.length === 0 ? (
          <div className="text-dojo-muted">No children yet.</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {children.map((c) => {
              const bal = balances[c.id] ?? 0;
              const inConsequence = c.consequence_threshold > 0 && bal <= c.consequence_threshold;
              return (
                <div key={c.id} className="py-3">
                  <div className="flex items-center gap-4">
                    <div
                      className="text-4xl w-14 h-14 flex items-center justify-center rounded-2xl"
                      style={{ background: `${c.theme_color || '#6366f1'}22` }}
                    >
                      {c.avatar_emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold flex items-center gap-2 flex-wrap">
                        <span style={{ color: c.theme_color || '#6366f1' }}>{c.name}</span>
                        {inConsequence && (
                          <span className="text-xs font-bold text-white bg-dojo-danger px-2 py-0.5 rounded-full">
                            ⚠️ Needs attention
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-dojo-muted">
                        Balance&nbsp;
                        <span className={inConsequence ? 'text-dojo-danger font-bold' : ''}>
                          {bal}
                        </span>
                        &nbsp;/ Goal {c.goal_points}
                        {c.consequence_threshold > 0 && (
                          <> · Threshold {c.consequence_threshold}</>
                        )}
                      </div>
                      {c.notes && (
                        <div className="text-xs text-dojo-muted mt-0.5 italic truncate">📝 {c.notes}</div>
                      )}
                    </div>
                    <div className="flex gap-1 flex-wrap justify-end">
                      <button
                        className="dojo-btn-ghost text-sm"
                        onClick={() => setAdjustTarget({ id: c.id, name: c.name })}
                      >
                        ± Points
                      </button>
                      <button
                        className="dojo-btn-ghost text-sm"
                        onClick={() => setEditTarget(c)}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        className="px-3 py-2 text-sm text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-xl transition"
                        onClick={() => setArchiveTarget({ id: c.id, name: c.name })}
                      >
                        📦 Archive
                      </button>
                      <button
                        className="px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition"
                        onClick={() => setDeleteTarget({ id: c.id, name: c.name })}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Archived children ── */}
      {archivedChildren.length > 0 && (
        <div className="dojo-card">
          <button
            className="w-full flex items-center justify-between"
            onClick={() => setShowArchived((v) => !v)}
          >
            <div className="font-display font-semibold text-base text-dojo-muted">
              📦 Archived children ({archivedChildren.length})
            </div>
            <span className={`text-dojo-muted transition-transform ${showArchived ? 'rotate-180' : ''}`}>▾</span>
          </button>
          {showArchived && (
            <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-700">
              {archivedChildren.map((c) => (
                <div key={c.id} className="flex items-center gap-4 py-3 opacity-60">
                  <div className="text-3xl">{c.avatar_emoji}</div>
                  <div className="flex-1 text-sm text-dojo-muted">{c.name} (archived)</div>
                  <div className="flex gap-1">
                    <button
                      className="px-3 py-2 text-sm text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl transition"
                      onClick={() => unarchive(c.id)}
                    >
                      ♻️ Unarchive
                    </button>
                    <button
                      className="px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition"
                      onClick={() => setDeleteTarget({ id: c.id, name: c.name })}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        open={archiveTarget !== null}
        icon="📦"
        title={`Archive ${archiveTarget?.name ?? ''}?`}
        message="This hides the child from the active list but keeps all their data. You can unarchive them any time."
        confirmLabel="Archive"
        danger={false}
        onConfirm={confirmArchive}
        onCancel={() => setArchiveTarget(null)}
      />
      <ConfirmModal
        open={deleteTarget !== null}
        icon="🗑️"
        title={`Delete ${deleteTarget?.name ?? ''}?`}
        message="This permanently deletes the child and ALL their history, points, and records. This cannot be undone."
        confirmLabel="Delete permanently"
        danger={true}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <AdjustModal
        open={adjustTarget !== null}
        childName={adjustTarget?.name ?? ''}
        onConfirm={confirmAdjust}
        onCancel={() => setAdjustTarget(null)}
      />
      <EditChildModal
        open={editTarget !== null}
        child={editTarget}
        onConfirm={confirmEdit}
        onCancel={() => setEditTarget(null)}
      />
    </div>
  );
}
