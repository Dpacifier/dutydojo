/**
 * emailService.ts — sends transactional emails via the DutyDojo send-email
 * Edge Function (server-side Resend key, no API key needed from the user).
 *
 * Handles:
 *  • Weekly digest emails (scheduled weekly by main.ts)
 *  • Approval alert emails (triggered on pending:add)
 *  • Test emails (triggered from Settings)
 */

import { getDb } from './db/database';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _env = (import.meta as any).env ?? {};
const SUPABASE_URL = ((_env.VITE_SUPABASE_URL as string) ?? '');
const EDGE_SEND    = `${SUPABASE_URL}/functions/v1/send-email`;

interface CloudConfig {
  access_token:       string;
  notification_email: string;
  weekly_digest:      number;
  approval_alerts:    number;
  user_email:         string;
}

function getConfig(): CloudConfig | null {
  const db   = getDb();
  const stmt = db.prepare('SELECT * FROM cloud_config LIMIT 1');
  const rows: CloudConfig[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject() as unknown as CloudConfig);
  stmt.free();
  return rows[0] ?? null;
}

/** Call the send-email Edge Function with the stored Supabase access token. */
async function callEdge(token: string, payload: Record<string, unknown>): Promise<boolean> {
  if (!SUPABASE_URL || !token) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(EDGE_SEND, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type':  'application/json',
      },
      body:   JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error('[email] Edge Function error', res.status, body);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[email] fetch error:', e);
    return false;
  }
}

// ── Test email ────────────────────────────────────────────────────────────────

export async function sendTestEmail(to: string): Promise<boolean> {
  const cfg = getConfig();
  if (!cfg?.access_token) return false;
  return callEdge(cfg.access_token, { type: 'test', to });
}

// ── Approval alert ─────────────────────────────────────────────────────────────

export async function sendApprovalAlert(
  childName: string,
  behaviourName: string,
  points = 0,
): Promise<void> {
  const cfg = getConfig();
  if (!cfg?.access_token || !cfg.approval_alerts) return;
  const to = cfg.notification_email || cfg.user_email;
  if (!to) return;
  await callEdge(cfg.access_token, {
    type: 'approval_alert', to, childName, behaviourName, points,
  });
}

// ── Weekly digest ─────────────────────────────────────────────────────────────

export async function sendWeeklyDigest(): Promise<boolean> {
  const cfg = getConfig();
  if (!cfg?.access_token || !cfg.weekly_digest) return false;
  const to = cfg.notification_email || cfg.user_email;
  if (!to) return false;

  const db = getDb();

  // Gather per-child weekly stats
  const childrenStmt = db.prepare('SELECT * FROM children WHERE archived = 0');
  const children: Array<{ name: string; balance: number; earned: number; streak: number }> = [];

  while (childrenStmt.step()) {
    const c = childrenStmt.getAsObject() as { id: number; name: string };

    const balStmt = db.prepare(
      'SELECT COALESCE(SUM(delta), 0) AS bal FROM history WHERE child_id = ?'
    );
    balStmt.bind([c.id]);
    balStmt.step();
    const balance = (balStmt.getAsObject() as { bal: number }).bal;
    balStmt.free();

    const earnStmt = db.prepare(
      "SELECT COALESCE(SUM(delta), 0) AS earned FROM history WHERE child_id = ? AND delta > 0 AND created_at >= datetime('now', '-7 days')"
    );
    earnStmt.bind([c.id]);
    earnStmt.step();
    const earned = (earnStmt.getAsObject() as { earned: number }).earned;
    earnStmt.free();

    // Streak (days with at least one positive event)
    const streakStmt = db.prepare(
      "SELECT DISTINCT date(created_at) AS d FROM history WHERE child_id = ? AND delta > 0 ORDER BY d DESC LIMIT 365"
    );
    streakStmt.bind([c.id]);
    let streak = 0;
    const days: string[] = [];
    while (streakStmt.step()) {
      days.push((streakStmt.getAsObject() as { d: string }).d);
    }
    streakStmt.free();
    const base = new Date();
    for (let i = 0; i < days.length; i++) {
      const expected = new Date(base);
      expected.setDate(base.getDate() - i);
      if (days[i] !== expected.toISOString().slice(0, 10)) break;
      streak++;
    }

    children.push({ name: c.name, balance, earned, streak });
  }
  childrenStmt.free();

  if (children.length === 0) return false;

  return callEdge(cfg.access_token, { type: 'weekly_digest', to, children });
}
