import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../store';
import { ConfirmModal, AssignConsequenceModal, EditConsequenceModal } from './Modal';
import type { AssignedConsequence, Child, Consequence } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function expiryLabel(ac: AssignedConsequence): string {
  if (ac.duration_days === 0 || !ac.expires_at) return 'Until resolved';
  const msLeft = new Date(ac.expires_at).getTime() - Date.now();
  if (msLeft <= 0) return 'Expiring now';
  const hours = Math.floor(msLeft / 3_600_000);
  if (hours < 24) return `${hours}h remaining`;
  const days = Math.ceil(msLeft / 86_400_000);
  return `${days} day${days === 1 ? '' : 's'} remaining`;
}

function expiryDate(ac: AssignedConsequence): string {
  if (!ac.expires_at) return '';
  return new Date(ac.expires_at).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

type ChildStatus = {
  child: Child;
  balance: number;
  status: 'below' | 'no-threshold' | 'ok';
};

// ── Component ────────────────────────────────────────────────────────────────

export function ManageConsequences() {
  const consequences = useApp((s) => s.consequences);
  const children     = useApp((s) => s.children);
  const refresh      = useApp((s) => s.refreshConsequences);

  // Library form
  const [name, setName]        = useState('');
  const [icon, setIcon]        = useState('⚠️');
  const [description, setDesc] = useState('');

  // Data
  const [childStatuses, setChildStatuses] = useState<ChildStatus[]>([]);
  const [assigned, setAssigned]           = useState<AssignedConsequence[]>([]);
  const [loading, setLoading]             = useState(true);

  // Modals
  const [assignTarget, setAssignTarget]   = useState<Child | null>(null);
  const [deleteTarget, setDeleteTarget]   = useState<{ id: number; name: string } | null>(null);
  const [editTarget, setEditTarget]       = useState<Consequence | null>(null);

  // Toast
  const [toast, setToast] = useState<{ id: number; text: string; ok: boolean } | null>(null);
  function showToast(text: string, ok = true) {
    const id = Date.now();
    setToast({ id, text, ok });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 2500);
  }

  // ── Load data (independent calls — one failure won't block the other) ────────
  async function loadData() {
    setLoading(true);

    // Load balances for all children
    const statuses: ChildStatus[] = await Promise.all(
      children.map(async (child) => {
        let balance = 0;
        try { balance = await window.dojo.getChildPoints(child.id); } catch { /* ignore */ }
        const t = child.consequence_threshold;
        const status: ChildStatus['status'] =
          t === 0 ? 'no-threshold' : balance <= t ? 'below' : 'ok';
        return { child, balance, status };
      })
    );
    setChildStatuses(statuses);

    // Load active assignments (separate call — won't block balances if it fails)
    try {
      const allActive = await window.dojo.getAllActiveConsequences();
      setAssigned(allActive);
    } catch {
      setAssigned([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (children.length > 0) loadData();
    else { setChildStatuses([]); setAssigned([]); setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children]);

  // Group assigned by child for the "Active" section
  const byChild = children
    .map((c) => ({ child: c, items: assigned.filter((a) => a.child_id === c.id) }))
    .filter((g) => g.items.length > 0);

  // ── Actions ──────────────────────────────────────────────────────────────────

  async function handleAssign(
    selections: Array<{ consequenceId: number; durationDays: number; note: string }>
  ) {
    if (!assignTarget) return;
    await Promise.all(
      selections.map((s) =>
        window.dojo.assignConsequence({
          childId: assignTarget.id,
          consequenceId: s.consequenceId,
          durationDays: s.durationDays,
          note: s.note,
        })
      )
    );
    const name = assignTarget.name;
    setAssignTarget(null);
    await loadData();
    showToast(`✅ Consequences assigned to ${name}`);
  }

  async function lift(ac: AssignedConsequence) {
    await window.dojo.resolveConsequence(ac.id);
    await loadData();
    showToast(`Lifted: ${ac.consequence_name}`);
  }

  async function addToLibrary() {
    if (!name.trim()) return;
    await window.dojo.addConsequence({
      name: name.trim(),
      icon: icon.trim() || '⚠️',
      description: description.trim(),
    });
    setName(''); setIcon('⚠️'); setDesc('');
    await refresh();
    showToast('Consequence added to library');
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await window.dojo.deleteConsequence(deleteTarget.id);
    setDeleteTarget(null);
    await refresh();
  }

  async function confirmEdit(patch: { name: string; icon: string; description: string }) {
    if (!editTarget) return;
    await window.dojo.updateConsequence({ id: editTarget.id, ...patch });
    setEditTarget(null);
    await refresh();
    showToast('✅ Consequence updated');
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (children.length === 0) {
    return (
      <div className="dojo-card text-dojo-muted text-sm">
        Add a child first to manage consequences.
      </div>
    );
  }

  const belowCount = childStatuses.filter((s) => s.status === 'below').length;

  return (
    <div className="space-y-6">

      {/* ── Children status + Assign ── */}
      <div className="dojo-card">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <div className="font-display font-semibold text-lg">Children</div>
            <div className="text-sm text-dojo-muted">
              Click <strong>Assign</strong> on any child to give them active consequences.
            </div>
          </div>
          {belowCount > 0 && (
            <span className="text-xs font-bold bg-red-100 text-dojo-danger border border-red-200 px-3 py-1 rounded-full">
              ⚠️ {belowCount} below threshold
            </span>
          )}
        </div>

        {loading ? (
          <div className="text-dojo-muted text-sm py-4 text-center">Loading…</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {childStatuses.map(({ child, balance, status }) => {
              const assignedCount = assigned.filter((a) => a.child_id === child.id).length;
              return (
                <div key={child.id} className="flex items-center gap-4 py-3">
                  <span className="text-4xl">{child.avatar_emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{child.name}</span>
                      {status === 'below' && (
                        <span className="text-xs font-bold bg-red-100 text-dojo-danger border border-red-200 px-2 py-0.5 rounded-full">
                          ⚠️ Below threshold
                        </span>
                      )}
                      {status === 'no-threshold' && (
                        <span className="text-xs text-dojo-muted bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 px-2 py-0.5 rounded-full">
                          No threshold set
                        </span>
                      )}
                      {assignedCount > 0 && (
                        <span className="text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                          {assignedCount} active
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-dojo-muted mt-0.5">
                      Balance <span className={`font-semibold ${status === 'below' ? 'text-dojo-danger' : ''}`}>{balance}</span>
                      {child.consequence_threshold > 0 && (
                        <> · Threshold <span className="font-semibold">{child.consequence_threshold}</span></>
                      )}
                      {status === 'no-threshold' && (
                        <> · <span className="text-xs italic">Set a threshold in the Children tab to enable automatic alerts</span></>
                      )}
                    </div>
                  </div>
                  <button
                    className={`px-4 py-2 text-sm font-semibold rounded-xl transition shrink-0 ${
                      status === 'below'
                        ? 'bg-dojo-danger text-white hover:bg-red-600'
                        : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-dojo-primary hover:border-dojo-primary hover:bg-violet-50 dark:hover:bg-violet-950/30'
                    }`}
                    onClick={() => setAssignTarget(child)}
                  >
                    {status === 'below' ? '⚠️ Assign consequences' : '+ Assign consequences'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Active assigned consequences ── */}
      <div className="dojo-card">
        <div className="font-display font-semibold text-lg mb-1">
          Active consequences
          {assigned.length > 0 && (
            <span className="ml-2 text-xs font-bold bg-red-100 text-dojo-danger border border-red-200 px-2 py-0.5 rounded-full">
              {assigned.length} active
            </span>
          )}
        </div>
        <p className="text-sm text-dojo-muted mb-4">
          Children can still earn points while under consequences — they just need to work back above their threshold.
        </p>

        {byChild.length === 0 ? (
          <div className="text-dojo-muted text-sm">
            No active consequences assigned yet. Use the <strong>Assign consequences</strong> button above.
          </div>
        ) : (
          <div className="space-y-5">
            {byChild.map(({ child, items }) => (
              <div key={child.id}>
                {/* Child header */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{child.avatar_emoji}</span>
                  <span className="font-semibold">{child.name}</span>
                  <span className="text-xs font-bold bg-red-100 text-dojo-danger border border-red-200 px-2 py-0.5 rounded-full">
                    {items.length} consequence{items.length > 1 ? 's' : ''}
                  </span>
                </div>

                {/* Consequence rows */}
                <div className="space-y-2 ml-9">
                  {items.map((ac) => (
                    <div
                      key={ac.id}
                      className="flex items-start gap-3 bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/50 rounded-xl px-3 py-3"
                    >
                      <span className="text-2xl shrink-0">{ac.consequence_icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-dojo-danger">{ac.consequence_name}</div>
                        {ac.consequence_description && (
                          <div className="text-xs text-red-500 mt-0.5">{ac.consequence_description}</div>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-xs bg-white dark:bg-slate-800 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 px-2 py-0.5 rounded-full font-semibold">
                            🕐 {expiryLabel(ac)}
                          </span>
                          {ac.expires_at && (
                            <span className="text-xs text-dojo-muted">
                              Expires {expiryDate(ac)}
                            </span>
                          )}
                          {ac.note && (
                            <span className="text-xs text-dojo-muted italic">"{ac.note}"</span>
                          )}
                        </div>
                      </div>
                      <button
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-xl transition shrink-0 mt-0.5"
                        onClick={() => lift(ac)}
                      >
                        ✓ Lift early
                      </button>
                    </div>
                  ))}

                  <button
                    className="text-xs text-dojo-primary font-semibold hover:underline mt-1"
                    onClick={() => setAssignTarget(child)}
                  >
                    + Assign more consequences to {child.name}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Consequence library ── */}
      <div className="dojo-card">
        <div className="font-display font-semibold text-lg mb-1">Consequence library</div>
        <p className="text-sm text-dojo-muted mb-4">
          These are the rules available to assign. The 8 defaults are pre-loaded — add your family's own or remove ones that don't fit.
        </p>

        {/* Add form */}
        <div className="grid md:grid-cols-4 gap-3 mb-3">
          <input
            className="dojo-input"
            placeholder="Icon"
            value={icon}
            maxLength={4}
            onChange={(e) => setIcon(e.target.value)}
          />
          <input
            className="dojo-input md:col-span-3"
            placeholder='Name, e.g. "No video games"'
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addToLibrary()}
          />
        </div>
        <input
          className="dojo-input mb-3"
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDesc(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addToLibrary()}
        />
        <button className="dojo-btn-primary mb-5" onClick={addToLibrary}>
          Add to library
        </button>

        {consequences.length === 0 ? (
          <div className="text-dojo-muted text-sm">No consequences yet.</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {consequences.map((c) => (
              <div key={c.id} className="flex items-start gap-4 py-3">
                <div className="text-3xl mt-0.5 shrink-0">{c.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{c.name}</div>
                  {c.description && (
                    <div className="text-sm text-dojo-muted mt-0.5">{c.description}</div>
                  )}
                </div>
                <button
                  className="dojo-btn-ghost shrink-0"
                  onClick={() => setEditTarget(c)}
                >
                  ✏️ Edit
                </button>
                <button
                  className="px-3 py-2 text-sm text-dojo-danger hover:bg-red-50 rounded-xl transition shrink-0"
                  onClick={() => setDeleteTarget({ id: c.id, name: c.name })}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── How it works ── */}
      <div className="dojo-card bg-violet-50 dark:bg-violet-950/30 border-violet-100 dark:border-violet-900/50">
        <div className="font-semibold text-dojo-primary mb-1">How consequences work</div>
        <div className="text-sm text-dojo-muted space-y-1.5">
          <p>
            Click <strong>Assign consequences</strong> on any child above to open the assignment panel.
            Pick which rules apply and set a duration — 1 day, 2 days, 3 days, 1 week, or "Until resolved".
          </p>
          <p>
            The child sees the full list of their active consequences on their screen, along with the
            time remaining. They can continue earning points — consequences lift automatically when
            the duration expires, or you can lift them early with <strong>✓ Lift early</strong>.
          </p>
          <p>
            To get automatic alerts when a child drops below a certain balance, set a <strong>needs
            attention threshold</strong> on them in the <strong>Children tab</strong>.
          </p>
        </div>
      </div>

      {/* ── Modals ── */}
      <AssignConsequenceModal
        open={assignTarget !== null}
        child={assignTarget}
        consequences={consequences}
        onConfirm={handleAssign}
        onCancel={() => setAssignTarget(null)}
      />
      <ConfirmModal
        open={deleteTarget !== null}
        icon="🗑️"
        title={`Remove "${deleteTarget?.name ?? ''}" from library?`}
        message="This removes it from the library. Any active assignments of this consequence will also be lifted."
        confirmLabel="Remove"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <EditConsequenceModal
        open={editTarget !== null}
        consequence={editTarget}
        onConfirm={confirmEdit}
        onCancel={() => setEditTarget(null)}
      />
    </div>
  );
}
