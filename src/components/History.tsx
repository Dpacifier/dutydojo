import { useEffect, useRef, useState } from 'react';
import { useApp } from '../store';
import type { HistoryEntry, HistoryExportRow } from '../types';

// ── Date parsing ─────────────────────────────────────────────────────────────
// Supabase returns ISO 8601 with timezone: "2024-01-15T10:30:00+00:00"
// SQLite (Electron) returns space-separated, no timezone: "2024-01-15 10:30:00"
// Appending 'Z' to a string that already has timezone info makes it invalid.
function parseEntryDate(s: string): Date {
  // If it already contains 'T' it's a proper ISO string — use as-is
  if (s.includes('T')) return new Date(s);
  // Otherwise it's the SQLite space-separated format — normalise it
  return new Date(s.replace(' ', 'T') + 'Z');
}

// ── CSV helpers ───────────────────────────────────────────────────────────────

const CSV_HEADERS = ['Date', 'Time', 'Child', 'Type', 'Reason', 'Points', 'Note'];

function kindLabel(k: HistoryEntry['kind']) {
  switch (k) {
    case 'positive': return 'Earned';
    case 'negative': return 'Deducted';
    case 'reward':   return 'Reward redeemed';
    case 'manual':   return 'Manual adjustment';
  }
}

function escapeCell(val: string | number): string {
  const s = String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCsv(rows: HistoryExportRow[]): string {
  const lines: string[] = [CSV_HEADERS.join(',')];
  for (const r of rows) {
    const d = parseEntryDate(r.created_at);
    const date = d.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
    const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    lines.push(
      [
        escapeCell(date),
        escapeCell(time),
        escapeCell(r.child_name),
        escapeCell(kindLabel(r.kind)),
        escapeCell(r.reason),
        escapeCell(r.delta),
        escapeCell(r.note ?? ''),
      ].join(',')
    );
  }
  return lines.join('\r\n');
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function todayStamp() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Inline note row ───────────────────────────────────────────────────────────

function NoteRow({ entry, onSaved }: { entry: HistoryEntry; onSaved: (note: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(entry.note ?? '');
  const inputRef              = useRef<HTMLInputElement>(null);

  function startEdit() {
    setDraft(entry.note ?? '');
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function save() {
    await window.dojo.updateHistoryNote({ historyId: entry.id, note: draft.trim() });
    setEditing(false);
    onSaved(draft.trim());
  }

  function cancel() {
    setDraft(entry.note ?? '');
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 mt-1.5">
        <input
          ref={inputRef}
          className="dojo-input text-xs py-1 flex-1"
          placeholder="Add a note…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') cancel();
          }}
        />
        <button className="text-xs text-dojo-primary font-semibold hover:underline" onClick={save}>Save</button>
        <button className="text-xs text-dojo-muted hover:underline" onClick={cancel}>Cancel</button>
      </div>
    );
  }

  return (
    <div className="mt-1 flex items-center gap-1.5">
      {entry.note ? (
        <span className="text-xs text-dojo-muted italic">"{entry.note}"</span>
      ) : null}
      <button
        className="text-xs text-dojo-muted hover:text-dojo-primary transition opacity-60 hover:opacity-100"
        onClick={startEdit}
        title="Add / edit note"
      >
        {entry.note ? '✏️' : '+ note'}
      </button>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function History() {
  const children       = useApp((s) => s.children);
  const activeChildId  = useApp((s) => s.activeChildId);
  const setActiveChild = useApp((s) => s.setActiveChild);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  // Date range filter
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate]     = useState('');

  // Export state
  const [exporting, setExporting]     = useState<'child' | 'all' | null>(null);
  const [toast, setToast]             = useState<string | null>(null);
  const toastTimer                    = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function loadHistory() {
    if (!activeChildId) return;
    const params: { childId: number; fromIso?: string; toIso?: string } = { childId: activeChildId };
    if (fromDate) params.fromIso = fromDate;
    if (toDate)   params.toIso   = toDate;
    const list = await window.dojo.getHistory(params);
    setEntries(list);
  }

  useEffect(() => {
    loadHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChildId, fromDate, toDate]);

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }

  function handleNoteUpdated(entryId: number, note: string) {
    setEntries((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, note } : e))
    );
  }

  async function exportChild() {
    if (!activeChildId || exporting) return;
    setExporting('child');
    try {
      const rows  = await window.dojo.exportHistoryForChild(activeChildId);
      const child = children.find((c) => c.id === activeChildId);
      if (rows.length === 0) { showToast('No history to export for this child.'); return; }
      const csv   = buildCsv(rows);
      const name  = child?.name.replace(/[^a-z0-9]/gi, '_') ?? 'child';
      downloadCsv(csv, `DutyDojo_${name}_${todayStamp()}.csv`);
      showToast(`✅ Exported ${rows.length} rows for ${child?.name ?? 'child'}`);
    } finally {
      setExporting(null);
    }
  }

  async function exportAll() {
    if (exporting) return;
    setExporting('all');
    try {
      const rows = await window.dojo.exportAllHistory();
      if (rows.length === 0) { showToast('No history to export yet.'); return; }
      const csv  = buildCsv(rows);
      downloadCsv(csv, `DutyDojo_AllChildren_${todayStamp()}.csv`);
      showToast(`✅ Exported ${rows.length} rows across all children`);
    } finally {
      setExporting(null);
    }
  }

  const activeChild = children.find((c) => c.id === activeChildId);

  if (children.length === 0) {
    return <div className="dojo-card">Add a child first.</div>;
  }

  return (
    <div className="space-y-6">
      {/* ── Child picker + export buttons ── */}
      <div className="dojo-card">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          {/* Child tabs */}
          <div className="flex flex-wrap gap-2">
            {children.map((c) => (
              <button
                key={c.id}
                className={`px-3 py-2 rounded-xl border text-sm ${
                  c.id === activeChildId
                    ? 'bg-dojo-primary text-white border-dojo-primary'
                    : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600'
                }`}
                onClick={() => setActiveChild(c.id)}
              >
                {c.avatar_emoji} {c.name}
              </button>
            ))}
          </div>

          {/* Export buttons */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={exportChild}
              disabled={!!exporting}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl border border-dojo-primary/30 bg-violet-50 dark:bg-violet-950/30 text-dojo-primary hover:bg-violet-100 dark:hover:bg-violet-950/50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              title={`Export ${activeChild?.name ?? 'this child'}'s full history as CSV`}
            >
              {exporting === 'child' ? (
                <span className="animate-spin text-base leading-none">⏳</span>
              ) : (
                <span>⬇️</span>
              )}
              Export {activeChild?.name ?? 'child'}
            </button>
            {children.length > 1 && (
              <button
                onClick={exportAll}
                disabled={!!exporting}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 hover:border-dojo-primary/40 disabled:opacity-50 disabled:cursor-not-allowed transition"
                title="Export all children's history as a single CSV"
              >
                {exporting === 'all' ? (
                  <span className="animate-spin text-base leading-none">⏳</span>
                ) : (
                  <span>📦</span>
                )}
                Export all
              </button>
            )}
          </div>
        </div>

        {/* ── Date range filter ── */}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-dojo-muted uppercase tracking-wide">Filter by date:</span>
          <div className="flex items-center gap-2">
            <label className="text-xs text-dojo-muted">From</label>
            <input
              type="date"
              className="dojo-input text-sm py-1.5"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-dojo-muted">To</label>
            <input
              type="date"
              className="dojo-input text-sm py-1.5"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          {(fromDate || toDate) && (
            <button
              className="text-xs text-dojo-primary font-semibold hover:underline"
              onClick={() => { setFromDate(''); setToDate(''); }}
            >
              Clear filter
            </button>
          )}
        </div>

        {/* Hint */}
        <div className="mt-2 text-xs text-dojo-muted">
          CSV includes every entry ever logged — no row limit.
        </div>
      </div>

      {/* ── History list ── */}
      <div className="dojo-card">
        <div className="font-display font-semibold text-lg mb-3">
          History ({entries.length} {fromDate || toDate ? 'in range' : 'most recent'})
        </div>
        {entries.length === 0 ? (
          <div className="text-dojo-muted text-sm">
            {fromDate || toDate ? 'No entries in the selected date range.' : 'Nothing logged yet.'}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {entries.map((e) => (
              <div key={e.id} className="py-3 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{e.reason}</div>
                  <div className="text-xs text-dojo-muted">
                    {parseEntryDate(e.created_at).toLocaleString()} · {kindLabel(e.kind)}
                  </div>
                  <NoteRow
                    entry={e}
                    onSaved={(note) => handleNoteUpdated(e.id, note)}
                  />
                </div>
                <div
                  className={`tabular-nums font-bold shrink-0 ${
                    e.delta > 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {e.delta > 0 ? `+${e.delta}` : e.delta}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-2xl bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 font-bold shadow-dojo z-50 whitespace-nowrap text-sm">
          {toast}
        </div>
      )}
    </div>
  );
}
