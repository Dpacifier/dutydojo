import type { Database } from 'sql.js';

function countRows(db: Database, table: string): number {
  const stmt = db.prepare(`SELECT COUNT(*) AS c FROM ${table}`);
  stmt.step();
  const row = stmt.getAsObject() as { c: unknown };
  stmt.free();
  return Number(row.c); // sql.js may return numeric columns as strings in some builds
}

function columnExists(db: Database, table: string, column: string): boolean {
  const rows: Array<{ name: string }> = [];
  const stmt = db.prepare(`PRAGMA table_info(${table})`);
  while (stmt.step()) rows.push(stmt.getAsObject() as { name: string });
  stmt.free();
  return rows.some((r) => r.name === column);
}

export function runMigrations(db: Database) {
  // ── Create tables (fresh install) ──────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS parents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      default_start_points INTEGER NOT NULL DEFAULT 100,
      default_goal_points  INTEGER NOT NULL DEFAULT 150,
      default_threshold    INTEGER NOT NULL DEFAULT 50,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS children (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      avatar_emoji TEXT DEFAULT '🥋',
      goal_points INTEGER NOT NULL DEFAULT 100,
      consequence_threshold INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS behaviours (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('positive','negative')),
      points INTEGER NOT NULL,
      icon TEXT DEFAULT '⭐',
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS rewards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      cost INTEGER NOT NULL,
      icon TEXT DEFAULT '🎁',
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('positive','negative','reward','manual')),
      behaviour_id INTEGER REFERENCES behaviours(id) ON DELETE SET NULL,
      reward_id INTEGER REFERENCES rewards(id) ON DELETE SET NULL,
      fulfilled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS consequences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT '⚠️',
      description TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS child_consequences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
      consequence_id INTEGER NOT NULL REFERENCES consequences(id) ON DELETE CASCADE,
      duration_days INTEGER NOT NULL DEFAULT 0,
      assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT,
      resolved INTEGER NOT NULL DEFAULT 0,
      resolved_at TEXT,
      note TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_child_consequences_child ON child_consequences(child_id, resolved);

    CREATE INDEX IF NOT EXISTS idx_history_child_created ON history(child_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS child_behaviour_excludes (
      child_id     INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
      behaviour_id INTEGER NOT NULL REFERENCES behaviours(id) ON DELETE CASCADE,
      PRIMARY KEY (child_id, behaviour_id)
    );

    CREATE TABLE IF NOT EXISTS pending_behaviours (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
      behaviour_id INTEGER NOT NULL REFERENCES behaviours(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // ── ALTER TABLE migrations for existing databases ──────────────────────────
  if (!columnExists(db, 'parents', 'require_approval')) {
    db.run('ALTER TABLE parents ADD COLUMN require_approval INTEGER NOT NULL DEFAULT 0');
  }
  if (!columnExists(db, 'parents', 'recovery_question')) {
    db.run("ALTER TABLE parents ADD COLUMN recovery_question TEXT NOT NULL DEFAULT ''");
  }
  if (!columnExists(db, 'parents', 'recovery_answer_hash')) {
    db.run("ALTER TABLE parents ADD COLUMN recovery_answer_hash TEXT NOT NULL DEFAULT ''");
  }
  if (!columnExists(db, 'parents', 'default_start_points')) {
    db.run('ALTER TABLE parents ADD COLUMN default_start_points INTEGER NOT NULL DEFAULT 100');
  }
  if (!columnExists(db, 'parents', 'default_goal_points')) {
    db.run('ALTER TABLE parents ADD COLUMN default_goal_points INTEGER NOT NULL DEFAULT 150');
  }
  if (!columnExists(db, 'parents', 'default_threshold')) {
    db.run('ALTER TABLE parents ADD COLUMN default_threshold INTEGER NOT NULL DEFAULT 50');
  }
  if (!columnExists(db, 'children', 'consequence_threshold')) {
    db.run('ALTER TABLE children ADD COLUMN consequence_threshold INTEGER NOT NULL DEFAULT 0');
  }
  if (!columnExists(db, 'history', 'fulfilled')) {
    db.run('ALTER TABLE history ADD COLUMN fulfilled INTEGER NOT NULL DEFAULT 0');
  }
  if (!columnExists(db, 'history', 'note')) {
    db.run("ALTER TABLE history ADD COLUMN note TEXT NOT NULL DEFAULT ''");
  }

  // ── Wave-2 migrations ──────────────────────────────────────────────────────
  if (!columnExists(db, 'children', 'archived')) {
    db.run('ALTER TABLE children ADD COLUMN archived INTEGER NOT NULL DEFAULT 0');
  }
  if (!columnExists(db, 'children', 'notes')) {
    db.run("ALTER TABLE children ADD COLUMN notes TEXT NOT NULL DEFAULT ''");
  }
  if (!columnExists(db, 'children', 'theme_color')) {
    db.run("ALTER TABLE children ADD COLUMN theme_color TEXT NOT NULL DEFAULT '#6366f1'");
  }
  if (!columnExists(db, 'behaviours', 'daily_limit')) {
    db.run('ALTER TABLE behaviours ADD COLUMN daily_limit INTEGER NOT NULL DEFAULT 0');
  }
  if (!columnExists(db, 'behaviours', 'category')) {
    db.run("ALTER TABLE behaviours ADD COLUMN category TEXT NOT NULL DEFAULT ''");
  }
  if (!columnExists(db, 'parents', 'kid_pin')) {
    db.run("ALTER TABLE parents ADD COLUMN kid_pin TEXT NOT NULL DEFAULT ''");
  }
  if (!columnExists(db, 'parents', 'max_points_per_day')) {
    db.run('ALTER TABLE parents ADD COLUMN max_points_per_day INTEGER NOT NULL DEFAULT 0');
  }

  // ── Wave-3: cloud sync config ──────────────────────────────────────────────
  db.run(`
    CREATE TABLE IF NOT EXISTS cloud_config (
      id                 INTEGER PRIMARY KEY CHECK (id = 1),
      access_token       TEXT NOT NULL DEFAULT '',
      refresh_token      TEXT NOT NULL DEFAULT '',
      user_id            TEXT NOT NULL DEFAULT '',
      user_email         TEXT NOT NULL DEFAULT '',
      last_pull_at       TEXT NOT NULL DEFAULT '',
      resend_api_key     TEXT NOT NULL DEFAULT '',
      notification_email TEXT NOT NULL DEFAULT '',
      weekly_digest      INTEGER NOT NULL DEFAULT 0,
      approval_alerts    INTEGER NOT NULL DEFAULT 0
    )
  `);

  // ── Seed default behaviours/rewards if tables are empty ───────────────────
  if (countRows(db, 'behaviours') === 0) {
    const defaults: Array<[string, 'positive' | 'negative', number, string]> = [
      ['Made the bed',         'positive',   5,  '🛏️'],
      ['Tidied room',          'positive',  10,  '🧹'],
      ['Helped with dishes',   'positive',  10,  '🍽️'],
      ['Finished homework',    'positive',  15,  '📚'],
      ['Was kind to sibling',  'positive',  10,  '💛'],
      ['Not listening',        'negative',  -5,  '🙉'],
      ['Left mess behind',     'negative',  -5,  '🧻'],
      ['Shouted / rude',       'negative', -10,  '😠'],
    ];
    const stmt = db.prepare(
      'INSERT INTO behaviours (name, kind, points, icon) VALUES (?, ?, ?, ?)'
    );
    for (const row of defaults) {
      stmt.run(row as unknown as Array<string | number>);
    }
    stmt.free();
  }

  if (countRows(db, 'consequences') === 0) {
    const defaults: Array<[string, string, string]> = [
      ['📵', 'No screen time',     'All devices off until further notice.'],
      ['🎮', 'No video games',     'Gaming privileges suspended for the day.'],
      ['🛏️', 'Early bedtime',      'Bedtime moved 30 minutes earlier tonight.'],
      ['🍪', 'No treats',          'No sweets, snacks, or dessert today.'],
      ['🏠', 'No playdates',       'Social outings are on hold for now.'],
      ['📺', 'No TV',              'Television is off limits for today.'],
      ['🚲', 'No outdoor play',    'Outdoor activities suspended until things improve.'],
      ['📚', 'Extra reading',      '20 minutes of reading added to the daily routine.'],
    ];
    const stmt = db.prepare(
      'INSERT INTO consequences (icon, name, description) VALUES (?, ?, ?)'
    );
    for (const row of defaults) {
      stmt.run(row as unknown as Array<string>);
    }
    stmt.free();
  }

  if (countRows(db, 'rewards') === 0) {
    const defaults: Array<[string, number, string]> = [
      ['30 min extra screen time', 30,  '📱'],
      ['Choose dinner tonight',    40,  '🍕'],
      ['Pick family movie',        50,  '🎬'],
      ['Stay up 30 min later',     60,  '🌙'],
      ['Ice cream trip',           80,  '🍦'],
      ['Day out — you choose',    100,  '🎡'],
      ['New book of your choice', 120,  '📖'],
      ['New small toy',           150,  '🧸'],
    ];
    const stmt = db.prepare('INSERT INTO rewards (name, cost, icon) VALUES (?, ?, ?)');
    for (const row of defaults) {
      stmt.run(row as unknown as Array<string | number>);
    }
    stmt.free();
  }
}
