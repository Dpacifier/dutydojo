/**
 * SyncService — push-on-change cloud sync via Supabase.
 *
 * Strategy:
 *  • Every local write fires pushRecord() in the background (fire & forget).
 *  • On sign-in: pushAll() to upload everything, then pull() for any remote changes.
 *  • On startup (already signed in): pull() to get remote changes since last pull.
 *  • pull() uses INSERT OR REPLACE with the Supabase local_id as the SQLite id.
 */

import { supabase } from './supabaseClient';
import { getDb, saveDb } from './db/database';
import type { Database } from 'sql.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function db(): Database {
  return getDb();
}

function rows<T>(sql: string, params: unknown[] = []): T[] {
  const stmt = db().prepare(sql);
  const result: T[] = [];
  stmt.bind(params as never);
  while (stmt.step()) result.push(stmt.getAsObject() as T);
  stmt.free();
  return result;
}

let _userId = '';
export function setUserId(id: string) { _userId = id; }
export function getUserId(): string   { return _userId; }

// ── Push single record ────────────────────────────────────────────────────────

type Table = 'children' | 'behaviours' | 'rewards' | 'consequences' | 'history';

interface PushPayload {
  table: Table;
  record: Record<string, unknown>;
}

const TABLE_MAP: Record<Table, string> = {
  children:     'dd_children',
  behaviours:   'dd_behaviours',
  rewards:      'dd_rewards',
  consequences: 'dd_consequences',
  history:      'dd_history',
};

/** Fire-and-forget push of a single local record. */
export async function pushRecord({ table, record }: PushPayload): Promise<void> {
  if (!_userId) return;
  const sb = supabase();
  if (!sb) return;
  try {
    const payload = { ...record, user_id: _userId, local_id: record.id, updated_at: new Date().toISOString() };
    delete (payload as Record<string, unknown>)['id'];
    await sb.from(TABLE_MAP[table]).upsert(payload, { onConflict: 'user_id,local_id' });
  } catch (e) {
    console.error('[sync] pushRecord error:', e);
  }
}

/** Push a settings row. */
export async function pushSettings(settings: Record<string, unknown>): Promise<void> {
  if (!_userId) return;
  const sb = supabase();
  if (!sb) return;
  try {
    await sb.from('dd_settings').upsert(
      { ...settings, user_id: _userId, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  } catch (e) {
    console.error('[sync] pushSettings error:', e);
  }
}

// ── Push all local data ───────────────────────────────────────────────────────

export async function pushAll(): Promise<void> {
  if (!_userId) return;
  const sb = supabase();
  if (!sb) return;

  try {
    const uid = _userId;
    const now = new Date().toISOString();

    const children     = rows<Record<string,unknown>>('SELECT * FROM children WHERE archived = 0');
    const behaviours   = rows<Record<string,unknown>>('SELECT * FROM behaviours');
    const rewards      = rows<Record<string,unknown>>('SELECT * FROM rewards');
    const consequences = rows<Record<string,unknown>>('SELECT * FROM consequences');
    const history      = rows<Record<string,unknown>>('SELECT * FROM history ORDER BY id DESC LIMIT 2000');

    const toCloud = (recs: Record<string,unknown>[]) =>
      recs.map(r => ({ ...r, user_id: uid, local_id: r.id, updated_at: now, id: undefined }));

    await Promise.all([
      sb.from('dd_children').upsert(toCloud(children), { onConflict: 'user_id,local_id' }),
      sb.from('dd_behaviours').upsert(toCloud(behaviours), { onConflict: 'user_id,local_id' }),
      sb.from('dd_rewards').upsert(toCloud(rewards), { onConflict: 'user_id,local_id' }),
      sb.from('dd_consequences').upsert(toCloud(consequences), { onConflict: 'user_id,local_id' }),
      ...(history.length ? [sb.from('dd_history').upsert(toCloud(history), { onConflict: 'user_id,local_id' })] : []),
    ]);

    // Settings
    const settings = rows<Record<string,unknown>>('SELECT * FROM parents LIMIT 1')[0];
    if (settings) {
      await sb.from('dd_settings').upsert({
        user_id: uid,
        require_approval:     Boolean(settings.require_approval),
        default_goal_points:  settings.default_goal_points,
        default_threshold:    settings.default_threshold,
        default_start_points: settings.default_start_points,
        max_points_per_day:   settings.max_points_per_day ?? 0,
        updated_at:           now,
      }, { onConflict: 'user_id' });
    }

    console.log('[sync] pushAll complete');
  } catch (e) {
    console.error('[sync] pushAll error:', e);
  }
}

// ── Pull remote data ──────────────────────────────────────────────────────────

export async function pullAll(): Promise<{ pulled: number; error?: string }> {
  if (!_userId) return { pulled: 0, error: 'Not signed in' };
  const sb = supabase();
  if (!sb) return { pulled: 0, error: 'Supabase not configured' };

  try {
    const uid = _userId;

    const [c, b, r, co, h, s] = await Promise.all([
      sb.from('dd_children').select('*').eq('user_id', uid),
      sb.from('dd_behaviours').select('*').eq('user_id', uid),
      sb.from('dd_rewards').select('*').eq('user_id', uid),
      sb.from('dd_consequences').select('*').eq('user_id', uid),
      sb.from('dd_history').select('*').eq('user_id', uid).order('created_at', { ascending: true }),
      sb.from('dd_settings').select('*').eq('user_id', uid).maybeSingle(),
    ]);

    let pulled = 0;
    const d = db();

    // Children
    if (c.data?.length) {
      const stmt = d.prepare(`INSERT OR REPLACE INTO children
        (id, name, avatar_emoji, goal_points, consequence_threshold, notes, theme_color, archived, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`);
      for (const row of c.data) {
        stmt.run([row.local_id, row.name, row.avatar_emoji, row.goal_points,
          row.consequence_threshold, row.notes ?? '', row.theme_color ?? '#6366f1', row.archived ? 1 : 0]);
        pulled++;
      }
      stmt.free();
    }

    // Behaviours
    if (b.data?.length) {
      const stmt = d.prepare(`INSERT OR REPLACE INTO behaviours
        (id, name, kind, points, icon, active, daily_limit, category)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const row of b.data) {
        stmt.run([row.local_id, row.name, row.kind, row.points, row.icon ?? '⭐',
          row.active ? 1 : 0, row.daily_limit ?? 0, row.category ?? '']);
        pulled++;
      }
      stmt.free();
    }

    // Rewards
    if (r.data?.length) {
      const stmt = d.prepare(`INSERT OR REPLACE INTO rewards (id, name, cost, icon, active) VALUES (?, ?, ?, ?, ?)`);
      for (const row of r.data) {
        stmt.run([row.local_id, row.name, row.cost, row.icon ?? '🎁', row.active ? 1 : 0]);
        pulled++;
      }
      stmt.free();
    }

    // Consequences
    if (co.data?.length) {
      const stmt = d.prepare(`INSERT OR REPLACE INTO consequences (id, name, icon, description, active) VALUES (?, ?, ?, ?, ?)`);
      for (const row of co.data) {
        stmt.run([row.local_id, row.name, row.icon ?? '⚠️', row.description ?? '', row.active ? 1 : 0]);
        pulled++;
      }
      stmt.free();
    }

    // History
    if (h.data?.length) {
      const stmt = d.prepare(`INSERT OR IGNORE INTO history
        (id, child_id, delta, reason, kind, note, fulfilled, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const row of h.data) {
        stmt.run([row.local_id, row.child_local_id, row.delta, row.reason,
          row.kind, row.note ?? '', row.fulfilled ? 1 : 0, row.created_at]);
        pulled++;
      }
      stmt.free();
    }

    // Settings (merge into parents row)
    if (s.data) {
      d.run(`UPDATE parents SET
        require_approval = ?, default_goal_points = ?, default_threshold = ?,
        default_start_points = ?, max_points_per_day = ?
        WHERE id = 1`, [
        s.data.require_approval ? 1 : 0,
        s.data.default_goal_points,
        s.data.default_threshold,
        s.data.default_start_points,
        s.data.max_points_per_day ?? 0,
      ]);
    }

    saveDb();
    console.log(`[sync] pullAll complete — ${pulled} records`);

    // Update last_pull_at
    d.run(`UPDATE cloud_config SET last_pull_at = datetime('now')`);

    return { pulled };
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    console.error('[sync] pullAll error:', msg);
    return { pulled: 0, error: msg };
  }
}
