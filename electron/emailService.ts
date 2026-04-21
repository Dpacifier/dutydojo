/**
 * EmailService — sends transactional emails via the Resend API.
 *
 * Note: Supabase Auth emails (sign-up confirmation, password reset, magic link)
 * are sent automatically by Supabase. Configure Resend as the SMTP provider
 * in your Supabase project → Authentication → SMTP Settings.
 *
 * This service handles:
 *  • Weekly digest emails (scheduled weekly by main.ts)
 *  • Approval alert emails (triggered when a child submits a pending behaviour)
 */

import { getDb } from './db/database';

interface CloudConfig {
  resend_api_key: string;
  notification_email: string;
  weekly_digest: number;
  approval_alerts: number;
  user_email: string;
}

function getConfig(): CloudConfig | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM cloud_config LIMIT 1');
  const rows: CloudConfig[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject() as unknown as CloudConfig);
  stmt.free();
  return rows[0] ?? null;
}

async function sendEmail(apiKey: string, payload: {
  from: string;
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error('[email] Resend error', res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error('[email] fetch error:', e);
    return false;
  }
}

// ── Approval alert ─────────────────────────────────────────────────────────────

export async function sendApprovalAlert(childName: string, behaviourName: string): Promise<void> {
  const cfg = getConfig();
  if (!cfg?.resend_api_key || !cfg.approval_alerts) return;
  const to = cfg.notification_email || cfg.user_email;
  if (!to) return;

  await sendEmail(cfg.resend_api_key, {
    from: 'DutyDojo <notifications@dutydojo.app>',
    to,
    subject: `⭐ ${childName} submitted a behaviour for approval`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#6366f1">DutyDojo – Approval Needed</h2>
        <p><strong>${childName}</strong> has submitted <strong>"${behaviourName}"</strong> and is waiting for your approval.</p>
        <p>Open the DutyDojo app and go to <strong>Approvals</strong> to review.</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
        <p style="color:#94a3b8;font-size:12px">DutyDojo · You're receiving this because approval alerts are enabled.</p>
      </div>
    `,
  });
}

// ── Weekly digest ─────────────────────────────────────────────────────────────

interface ChildSummary {
  name: string;
  avatar_emoji: string;
  balance: number;
  earned_this_week: number;
  goal_points: number;
}

export async function sendWeeklyDigest(): Promise<boolean> {
  const cfg = getConfig();
  if (!cfg?.resend_api_key || !cfg.weekly_digest) return false;
  const to = cfg.notification_email || cfg.user_email;
  if (!to) return false;

  const db = getDb();

  // Gather per-child weekly stats
  const childrenStmt = db.prepare('SELECT * FROM children WHERE archived = 0');
  const children: ChildSummary[] = [];
  while (childrenStmt.step()) {
    const c = childrenStmt.getAsObject() as { id: number; name: string; avatar_emoji: string; goal_points: number };

    // Current balance
    const balStmt = db.prepare(
      "SELECT COALESCE(SUM(delta), 0) AS bal FROM history WHERE child_id = ?"
    );
    balStmt.bind([c.id]);
    balStmt.step();
    const bal = (balStmt.getAsObject() as { bal: number }).bal;
    balStmt.free();

    // Earned this week (positive deltas)
    const earnStmt = db.prepare(
      "SELECT COALESCE(SUM(delta), 0) AS earned FROM history WHERE child_id = ? AND delta > 0 AND created_at >= datetime('now', '-7 days')"
    );
    earnStmt.bind([c.id]);
    earnStmt.step();
    const earned = (earnStmt.getAsObject() as { earned: number }).earned;
    earnStmt.free();

    children.push({ name: c.name, avatar_emoji: c.avatar_emoji, balance: bal, earned_this_week: earned, goal_points: c.goal_points });
  }
  childrenStmt.free();

  if (children.length === 0) return false;

  const rows = children.map(c => `
    <tr>
      <td style="padding:10px 12px">${c.avatar_emoji} ${c.name}</td>
      <td style="padding:10px 12px;text-align:center"><strong>+${c.earned_this_week}</strong></td>
      <td style="padding:10px 12px;text-align:center">${c.balance} / ${c.goal_points}</td>
    </tr>
  `).join('');

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <h2 style="color:#6366f1">🥋 DutyDojo – Weekly Family Summary</h2>
      <p>Here's how your family did this week:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <thead>
          <tr style="background:#f1f5f9">
            <th style="padding:10px 12px;text-align:left">Child</th>
            <th style="padding:10px 12px;text-align:center">Earned this week</th>
            <th style="padding:10px 12px;text-align:center">Balance / Goal</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
      <p style="color:#94a3b8;font-size:12px">DutyDojo · Weekly digest every Monday.</p>
    </div>
  `;

  return sendEmail(cfg.resend_api_key, {
    from: 'DutyDojo <digest@dutydojo.app>',
    to,
    subject: `🥋 DutyDojo weekly summary`,
    html,
  });
}

// ── Test email ────────────────────────────────────────────────────────────────

export async function sendTestEmail(apiKey: string, to: string): Promise<boolean> {
  return sendEmail(apiKey, {
    from: 'DutyDojo <notifications@dutydojo.app>',
    to,
    subject: '✅ DutyDojo – Email connected',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#6366f1">🥋 DutyDojo</h2>
        <p>Email notifications are working correctly.</p>
        <p style="color:#94a3b8;font-size:12px">You'll receive weekly digests and approval alerts at this address.</p>
      </div>
    `,
  });
}
