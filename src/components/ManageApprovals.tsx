import { useEffect, useState } from 'react';
import { useApp } from '../store';
import type { PendingBehaviour } from '../types';

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso.replace(' ', 'T') + 'Z').getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function ManageApprovals() {
  const refreshPendingCount = useApp((s) => s.refreshPendingCount);

  const [items, setItems]   = useState<PendingBehaviour[]>([]);
  const [busy, setBusy]     = useState<Record<number, 'approve' | 'reject'>>({});
  const [done, setDone]     = useState<Record<number, 'approved' | 'rejected'>>({});

  async function load() {
    const list = await window.dojo.listPending();
    setItems(list);
  }

  useEffect(() => { load(); }, []);

  async function approve(item: PendingBehaviour) {
    setBusy((b) => ({ ...b, [item.id]: 'approve' }));
    try {
      await window.dojo.approvePending(item.id);
      setDone((d) => ({ ...d, [item.id]: 'approved' }));
      setTimeout(() => {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        setDone((d) => { const n = { ...d }; delete n[item.id]; return n; });
        refreshPendingCount();
      }, 900);
    } finally {
      setBusy((b) => { const n = { ...b }; delete n[item.id]; return n; });
    }
  }

  async function reject(item: PendingBehaviour) {
    setBusy((b) => ({ ...b, [item.id]: 'reject' }));
    try {
      await window.dojo.rejectPending(item.id);
      setDone((d) => ({ ...d, [item.id]: 'rejected' }));
      setTimeout(() => {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        setDone((d) => { const n = { ...d }; delete n[item.id]; return n; });
        refreshPendingCount();
      }, 900);
    } finally {
      setBusy((b) => { const n = { ...b }; delete n[item.id]; return n; });
    }
  }

  async function approveAll() {
    for (const item of items) {
      if (!done[item.id]) await approve(item);
    }
  }

  async function rejectAll() {
    await window.dojo.rejectAllPending();
    await load();
    await refreshPendingCount();
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl">
        <div className="dojo-card text-center py-12">
          <div className="text-5xl mb-3">✅</div>
          <div className="font-display text-xl font-bold mb-1">All clear!</div>
          <div className="text-dojo-muted text-sm">No behaviour submissions waiting for review.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      {/* Info banner */}
      <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 rounded-2xl px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
        <span className="text-xl shrink-0">✋</span>
        <div>
          <span className="font-semibold">{items.length} submission{items.length === 1 ? '' : 's'} waiting.</span>
          {' '}Approve to add points, or reject to dismiss without applying.
        </div>
        {items.length > 1 && (
          <div className="ml-auto flex gap-2 shrink-0">
            <button
              className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl transition"
              onClick={approveAll}
            >
              ✓ Approve all
            </button>
            <button
              className="text-xs font-bold border border-red-300 dark:border-red-700 text-dojo-danger hover:bg-red-50 dark:hover:bg-red-950/30 px-3 py-1.5 rounded-xl transition"
              onClick={rejectAll}
            >
              ✕ Reject all
            </button>
          </div>
        )}
      </div>

      {/* Pending items */}
      {items.map((item) => {
        const approved = done[item.id] === 'approved';
        const rejected = done[item.id] === 'rejected';
        const isBusy   = !!busy[item.id];

        return (
          <div
            key={item.id}
            className={`dojo-card transition-all duration-300 ${
              approved ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30' :
              rejected ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 opacity-60'  :
              ''
            }`}
          >
            <div className="flex items-center gap-4">
              {/* Child avatar */}
              <div className="text-4xl shrink-0">{item.child_avatar}</div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold">{item.child_name}</span>
                  <span className="text-dojo-muted text-xs">·</span>
                  <span className="text-xs text-dojo-muted">{timeAgo(item.created_at)}</span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-2xl">{item.behaviour_icon}</span>
                  <span className="font-semibold text-sm">{item.behaviour_name}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                    item.behaviour_kind === 'positive'
                      ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                  }`}>
                    {item.behaviour_points > 0 ? '+' : ''}{item.behaviour_points} pts
                  </span>
                </div>
              </div>

              {/* Actions or result */}
              <div className="shrink-0 flex flex-col items-end gap-2">
                {approved ? (
                  <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">✅ Approved</div>
                ) : rejected ? (
                  <div className="text-sm font-bold text-dojo-muted">✕ Rejected</div>
                ) : (
                  <>
                    <button
                      className="text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-xl transition disabled:opacity-50"
                      disabled={isBusy}
                      onClick={() => approve(item)}
                    >
                      {busy[item.id] === 'approve' ? '…' : '✓ Approve'}
                    </button>
                    <button
                      className="text-sm font-medium text-dojo-danger border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30 px-4 py-1.5 rounded-xl transition disabled:opacity-50"
                      disabled={isBusy}
                      onClick={() => reject(item)}
                    >
                      {busy[item.id] === 'reject' ? '…' : '✕ Reject'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
