import { useEffect, useState } from 'react';
import { useApp } from '../store';
import type { PendingBehaviour } from '../types';

// ─── Weekly print ─────────────────────────────────────────────────────────────

function weekRange(): { from: Date; to: Date; label: string } {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun
  const diffToMon = (day === 0 ? -6 : 1 - day);
  const from = new Date(now);
  from.setDate(now.getDate() + diffToMon);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(from.getDate() + 6);
  to.setHours(23, 59, 59, 999);
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return { from, to, label: `${fmt(from)} – ${fmt(to)}` };
}

function fmtDate(iso: string): string {
  return new Date(iso.replace(' ', 'T') + (iso.includes('T') ? '' : 'Z'))
    .toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

async function openWeeklyPrint(
  children: Array<{ id: number; name: string; avatar_emoji: string }>,
) {
  // Fetch current balances via sibling comparison
  const snapshots = await window.dojo.getSiblingComparison();
  const balanceMap: Record<number, number> = {};
  for (const s of snapshots) balanceMap[s.child_id] = s.balance;
  const getBalance = (id: number) => balanceMap[id] ?? 0;
  const { from, to, label } = weekRange();
  const fromIso = from.toISOString();
  const toIso   = to.toISOString();

  const sections = await Promise.all(
    children.map(async (c) => {
      const entries = await window.dojo.getHistory({ childId: c.id, fromIso, toIso });
      const earned  = entries.filter((e) => e.delta > 0).reduce((s, e) => s + e.delta, 0);
      const deducted = entries.filter((e) => e.delta < 0).reduce((s, e) => s + e.delta, 0);
      const balance  = getBalance(c.id);
      return { child: c, entries, earned, deducted, balance };
    }),
  );

  const rows = sections.map(({ child, entries, earned, deducted, balance }) => {
    const entryRows = entries.length === 0
      ? `<tr><td colspan="3" style="color:#94a3b8;font-style:italic;padding:6px 8px">No activity this week</td></tr>`
      : entries.map((e) => `
          <tr>
            <td style="padding:5px 8px;color:#64748b;font-size:12px">${fmtDate(e.created_at)}</td>
            <td style="padding:5px 8px">${e.reason}</td>
            <td style="padding:5px 8px;text-align:right;font-weight:600;color:${e.delta >= 0 ? '#16a34a' : '#dc2626'}">${e.delta > 0 ? '+' : ''}${e.delta}</td>
          </tr>`).join('');

    return `
      <div style="margin-bottom:28px;page-break-inside:avoid">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;border-bottom:2px solid #e2e8f0;padding-bottom:8px">
          <span style="font-size:32px">${child.avatar_emoji}</span>
          <div>
            <div style="font-size:18px;font-weight:700">${child.name}</div>
            <div style="font-size:12px;color:#64748b">
              Balance: <strong>${balance} pts</strong>
              &nbsp;·&nbsp; Earned this week: <strong style="color:#16a34a">+${earned}</strong>
              ${deducted !== 0 ? `&nbsp;·&nbsp; Deducted: <strong style="color:#dc2626">${deducted}</strong>` : ''}
            </div>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:#f8fafc">
              <th style="text-align:left;padding:5px 8px;font-weight:600;color:#475569;width:120px">Date</th>
              <th style="text-align:left;padding:5px 8px;font-weight:600;color:#475569">Behaviour</th>
              <th style="text-align:right;padding:5px 8px;font-weight:600;color:#475569;width:70px">Points</th>
            </tr>
          </thead>
          <tbody>${entryRows}</tbody>
        </table>
      </div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>DutyDojo — Weekly Report ${label}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 24px 32px; color: #1e293b; }
    @media print { body { padding: 12px 20px; } }
    table { border-collapse: collapse; }
    tr:nth-child(even) { background: #f8fafc; }
  </style>
</head>
<body>
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;border-bottom:3px solid #6366f1;padding-bottom:12px">
    <div>
      <div style="font-size:22px;font-weight:800;color:#6366f1">DutyDojo</div>
      <div style="font-size:14px;color:#64748b">Weekly Behaviour Report</div>
    </div>
    <div style="text-align:right;font-size:13px;color:#64748b">
      <div style="font-weight:600">${label}</div>
      <div>Printed ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
    </div>
  </div>
  ${rows || '<p style="color:#94a3b8">No children found.</p>'}
  <div style="margin-top:32px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center">
    Generated by DutyDojo · dutydojo.com
  </div>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=800,height=700');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 300);
}

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
  const children            = useApp((s) => s.children);

  const [items, setItems]       = useState<PendingBehaviour[]>([]);
  const [busy, setBusy]         = useState<Record<number, 'approve' | 'reject'>>({});
  const [done, setDone]         = useState<Record<number, 'approved' | 'rejected'>>({});
  const [printBusy, setPrintBusy] = useState(false);

  async function handlePrint() {
    setPrintBusy(true);
    try {
      await openWeeklyPrint(
        children.filter((c) => !c.archived),
      );
    } finally {
      setPrintBusy(false);
    }
  }

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
      <div className="max-w-2xl space-y-3">
        <div className="dojo-card text-center py-12">
          <div className="text-5xl mb-3">\u2705</div>
          <div className="font-display text-xl font-bold mb-1">All clear!</div>
          <div className="text-dojo-muted text-sm">No behaviour submissions waiting for review.</div>
        </div>
        <div className="flex justify-end">
          <button
            className="text-sm font-medium text-dojo-muted border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 px-4 py-2 rounded-xl transition flex items-center gap-2 disabled:opacity-50"
            onClick={handlePrint}
            disabled={printBusy}
          >
            \U0001f5a8\ufe0f {printBusy ? 'Preparing\u2026' : 'Weekly Report'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      {/* Weekly report print button */}
      <div className="flex justify-end">
        <button
          className="text-sm font-medium text-dojo-muted border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 px-4 py-2 rounded-xl transition flex items-center gap-2 disabled:opacity-50"
          onClick={handlePrint}
          disabled={printBusy}
        >
          \U0001f5a8\ufe0f {printBusy ? 'Preparing\u2026' : 'Weekly Report'}
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 rounded-2xl px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
        <span className="text-xl shrink-0">\u270b</span>
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
              \u2713 Approve all
            </button>
            <button
              className="text-xs font-bold border border-red-300 dark:border-red-700 text-dojo-danger hover:bg-red-50 dark:hover:bg-red-950/30 px-3 py-1.5 rounded-xl transition"
              onClick={rejectAll}
            >
              \u2715 Reject all
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
                  <span className="text-dojo-muted text-xs">\u00b7</span>
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
                  <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">\u2705 Approved</div>
                ) : rejected ? (
                  <div className="text-sm font-bold text-dojo-muted">\u2715 Rejected</div>
                ) : (
                  <>
                    <button
                      className="text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-xl transition disabled:opacity-50"
                      disabled={isBusy}
                      onClick={() => approve(item)}
                    >
                      {busy[item.id] === 'approve' ? '\u2026' : '\u2713 Approve'}
                    </button>
                    <button
                      className="text-sm font-medium text-dojo-danger border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30 px-4 py-1.5 rounded-xl transition disabled:opacity-50"
                      disabled={isBusy}
                      onClick={() => reject(item)}
                    >
                      {busy[item.id] === 'reject' ? '\u2026' : '\u2715 Reject'}
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
