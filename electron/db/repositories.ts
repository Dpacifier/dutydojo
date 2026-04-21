import bcrypt from 'bcryptjs';
import type { BindParams } from 'sql.js';
import { getDb, saveDb } from './database';

// ── Shared types ──────────────────────────────────────────────────────────────

export type Child = {
  id: number;
  name: string;
  avatar_emoji: string;
  goal_points: number;
  consequence_threshold: number;
  archived: number; // 0 | 1
  notes: string;
  theme_color: string; // hex colour
  created_at: string;
};

export type Behaviour = {
  id: number;
  name: string;
  kind: 'positive' | 'negative';
  points: number;
  icon: string;
  active: number;
  daily_limit: number; // 0 = unlimited
  category: string;
};

export type Reward = {
  id: number;
  name: string;
  cost: number;
  icon: string;
  active: number;
};

export type HistoryEntry = {
  id: number;
  child_id: number;
  delta: number;
  reason: string;
  kind: 'positive' | 'negative' | 'reward' | 'manual';
  behaviour_id: number | null;
  reward_id: number | null;
  fulfilled: number; // 0 = pending, 1 = fulfilled (only relevant for kind='reward')
  created_at: string;
};

export type ParentSettings = {
  default_start_points: number;
  default_goal_points: number;
  default_threshold: number;
  require_approval: number; // 0 | 1
  max_points_per_day: number; // 0 = unlimited
};

export type PendingBehaviour = {
  id: number;
  child_id: number;
  behaviour_id: number;
  created_at: string;
  // joined
  child_name: string;
  child_avatar: string;
  behaviour_name: string;
  behaviour_icon: string;
  behaviour_points: number;
  behaviour_kind: 'positive' | 'negative';
};

export type Consequence = {
  id: number;
  name: string;
  icon: string;
  description: string;
  active: number;
  created_at: string;
};

export type AssignedConsequence = {
  id: number;
  child_id: number;
  consequence_id: number;
  duration_days: number;
  assigned_at: string;
  expires_at: string | null;
  resolved: number;
  resolved_at: string | null;
  note: string;
  // joined from consequences table
  consequence_name: string;
  consequence_icon: string;
  consequence_description: string;
  // joined from children table
  child_name: string;
  child_avatar: string;
};

// ── sql.js helpers ────────────────────────────────────────────────────────────

function one<T>(sql: string, params: BindParams = []): T | undefined {
  const stmt = getDb().prepare(sql);
  try {
    stmt.bind(params);
    if (stmt.step()) return stmt.getAsObject() as T;
    return undefined;
  } finally {
    stmt.free();
  }
}

function many<T>(sql: string, params: BindParams = []): T[] {
  const stmt = getDb().prepare(sql);
  const rows: T[] = [];
  try {
    stmt.bind(params);
    while (stmt.step()) rows.push(stmt.getAsObject() as T);
    return rows;
  } finally {
    stmt.free();
  }
}

function run(sql: string, params: BindParams = []): void {
  const stmt = getDb().prepare(sql);
  try {
    stmt.bind(params);
    stmt.step();
  } finally {
    stmt.free();
  }
}

function lastInsertId(): number {
  const row = one<{ id: number }>('SELECT last_insert_rowid() AS id');
  return row?.id ?? 0;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authRepo = {
  isSetup(): boolean {
    const row = one<{ c: number }>('SELECT COUNT(*) AS c FROM parents');
    return (row?.c ?? 0) > 0;
  },
  setup(name: string, password: string): void {
    const hash = bcrypt.hashSync(password, 10);
    run('INSERT INTO parents (name, password_hash) VALUES (?, ?)', [name, hash]);
    saveDb();
  },
  verify(password: string): boolean {
    const row = one<{ password_hash: string }>(
      'SELECT password_hash FROM parents ORDER BY id LIMIT 1'
    );
    if (!row) return false;
    return bcrypt.compareSync(password, row.password_hash);
  },
  changePassword(oldPassword: string, newPassword: string): boolean {
    if (!this.verify(oldPassword)) return false;
    const hash = bcrypt.hashSync(newPassword, 10);
    run(
      'UPDATE parents SET password_hash = ? WHERE id = (SELECT id FROM parents ORDER BY id LIMIT 1)',
      [hash]
    );
    saveDb();
    return true;
  },
  /** Returns true when a recovery question + answer have been configured. */
  hasRecovery(): boolean {
    const row = one<{ q: string }>(
      "SELECT recovery_question AS q FROM parents ORDER BY id LIMIT 1"
    );
    return !!(row?.q);
  },
  /** Returns the stored recovery question text, or null if not set. */
  getRecoveryQuestion(): string | null {
    const row = one<{ q: string }>(
      "SELECT recovery_question AS q FROM parents ORDER BY id LIMIT 1"
    );
    return row?.q || null;
  },
  /** Saves (or updates) the recovery question + bcrypt-hashed answer.
   *  The answer is normalised to lowercase before hashing. */
  setRecovery(question: string, answer: string): void {
    const hash = bcrypt.hashSync(answer.trim().toLowerCase(), 10);
    run(
      'UPDATE parents SET recovery_question = ?, recovery_answer_hash = ? WHERE id = (SELECT id FROM parents ORDER BY id LIMIT 1)',
      [question, hash]
    );
    saveDb();
  },
  /** Verifies the answer (case-insensitive) and, if correct, resets the
   *  parent password to newPassword. Returns true on success. */
  verifyRecoveryAndReset(answer: string, newPassword: string): boolean {
    const row = one<{ recovery_answer_hash: string }>(
      'SELECT recovery_answer_hash FROM parents ORDER BY id LIMIT 1'
    );
    if (!row?.recovery_answer_hash) return false;
    if (!bcrypt.compareSync(answer.trim().toLowerCase(), row.recovery_answer_hash)) return false;
    const newHash = bcrypt.hashSync(newPassword, 10);
    run(
      'UPDATE parents SET password_hash = ? WHERE id = (SELECT id FROM parents ORDER BY id LIMIT 1)',
      [newHash]
    );
    saveDb();
    return true;
  },

  // ── Kid PIN ─────────────────────────────────────────────────────────────────
  hasKidPin(): boolean {
    const row = one<{ p: string }>('SELECT kid_pin AS p FROM parents ORDER BY id LIMIT 1');
    return !!(row?.p);
  },
  setKidPin(pin: string): void {
    const hash = bcrypt.hashSync(pin, 10);
    run(
      'UPDATE parents SET kid_pin = ? WHERE id = (SELECT id FROM parents ORDER BY id LIMIT 1)',
      [hash]
    );
    saveDb();
  },
  verifyKidPin(pin: string): boolean {
    const row = one<{ kid_pin: string }>('SELECT kid_pin FROM parents ORDER BY id LIMIT 1');
    if (!row?.kid_pin) return true; // no PIN set → always pass
    return bcrypt.compareSync(pin, row.kid_pin);
  },
  clearKidPin(): void {
    run(
      "UPDATE parents SET kid_pin = '' WHERE id = (SELECT id FROM parents ORDER BY id LIMIT 1)"
    );
    saveDb();
  },
};

// ── Parent settings ───────────────────────────────────────────────────────────

export const settingsRepo = {
  get(): ParentSettings {
    const row = one<ParentSettings>(
      'SELECT default_start_points, default_goal_points, default_threshold, require_approval, max_points_per_day FROM parents ORDER BY id LIMIT 1'
    );
    return row ?? {
      default_start_points: 100,
      default_goal_points: 150,
      default_threshold: 50,
      require_approval: 0,
      max_points_per_day: 0,
    };
  },
  save(s: ParentSettings): void {
    run(
      `UPDATE parents SET
         default_start_points = ?,
         default_goal_points  = ?,
         default_threshold    = ?,
         require_approval     = ?,
         max_points_per_day   = ?
       WHERE id = (SELECT id FROM parents ORDER BY id LIMIT 1)`,
      [s.default_start_points, s.default_goal_points, s.default_threshold, s.require_approval ?? 0, s.max_points_per_day ?? 0]
    );
    saveDb();
  },
};

// ── Children ──────────────────────────────────────────────────────────────────

export const childrenRepo = {
  /** Active (non-archived) children only */
  list(): Child[] {
    return many<Child>('SELECT * FROM children WHERE archived = 0 ORDER BY created_at');
  },
  /** All children including archived */
  listAll(): Child[] {
    return many<Child>('SELECT * FROM children ORDER BY archived, created_at');
  },
  add(
    name: string,
    avatar?: string,
    goal?: number,
    threshold?: number,
    initialPoints?: number,
    themeColor?: string
  ): Child {
    run(
      'INSERT INTO children (name, avatar_emoji, goal_points, consequence_threshold, theme_color) VALUES (?, ?, ?, ?, ?)',
      [name, avatar ?? '🥋', goal ?? 100, threshold ?? 0, themeColor ?? '#6366f1']
    );
    const id = lastInsertId();
    if (initialPoints && initialPoints > 0) {
      run(
        'INSERT INTO history (child_id, delta, reason, kind) VALUES (?, ?, ?, ?)',
        [id, initialPoints, 'Starting balance', 'manual']
      );
    }
    saveDb();
    return one<Child>('SELECT * FROM children WHERE id = ?', [id])!;
  },
  update(
    id: number,
    patch: Partial<Pick<Child, 'name' | 'avatar_emoji' | 'goal_points' | 'consequence_threshold' | 'notes' | 'theme_color'>>
  ): Child {
    const current = one<Child>('SELECT * FROM children WHERE id = ?', [id])!;
    const merged = { ...current, ...patch };
    run(
      'UPDATE children SET name = ?, avatar_emoji = ?, goal_points = ?, consequence_threshold = ?, notes = ?, theme_color = ? WHERE id = ?',
      [merged.name, merged.avatar_emoji, merged.goal_points, merged.consequence_threshold, merged.notes ?? '', merged.theme_color ?? '#6366f1', id]
    );
    saveDb();
    return one<Child>('SELECT * FROM children WHERE id = ?', [id])!;
  },
  archive(id: number): void {
    run('UPDATE children SET archived = 1 WHERE id = ?', [id]);
    saveDb();
  },
  unarchive(id: number): void {
    run('UPDATE children SET archived = 0 WHERE id = ?', [id]);
    saveDb();
  },
  remove(id: number): void {
    run('DELETE FROM children WHERE id = ?', [id]);
    saveDb();
  },
};

// ── Behaviours ────────────────────────────────────────────────────────────────

export const behavioursRepo = {
  /** Active-only — used by the store / kid view */
  list(): Behaviour[] {
    return many<Behaviour>(
      'SELECT * FROM behaviours WHERE active = 1 ORDER BY kind DESC, name'
    );
  },
  /** All rows including paused — used by the parent management UI */
  listAll(): Behaviour[] {
    return many<Behaviour>(
      'SELECT * FROM behaviours ORDER BY kind DESC, active DESC, name'
    );
  },
  /** Pause (active=0) or re-enable (active=1) a behaviour */
  setActive(id: number, active: 0 | 1): void {
    run('UPDATE behaviours SET active = ? WHERE id = ?', [active, id]);
    saveDb();
  },
  add(name: string, kind: 'positive' | 'negative', points: number, icon?: string, dailyLimit?: number, category?: string): Behaviour {
    run('INSERT INTO behaviours (name, kind, points, icon, daily_limit, category) VALUES (?, ?, ?, ?, ?, ?)', [
      name,
      kind,
      points,
      icon ?? (kind === 'positive' ? '⭐' : '⚠️'),
      dailyLimit ?? 0,
      category ?? '',
    ]);
    const id = lastInsertId();
    saveDb();
    return one<Behaviour>('SELECT * FROM behaviours WHERE id = ?', [id])!;
  },
  update(
    id: number,
    patch: Partial<Pick<Behaviour, 'name' | 'kind' | 'points' | 'icon' | 'daily_limit' | 'category'>>
  ): Behaviour {
    const current = one<Behaviour>('SELECT * FROM behaviours WHERE id = ?', [id])!;
    const merged = { ...current, ...patch };
    run('UPDATE behaviours SET name = ?, kind = ?, points = ?, icon = ?, daily_limit = ?, category = ? WHERE id = ?', [
      merged.name, merged.kind, merged.points, merged.icon, merged.daily_limit ?? 0, merged.category ?? '', id,
    ]);
    saveDb();
    return one<Behaviour>('SELECT * FROM behaviours WHERE id = ?', [id])!;
  },
  remove(id: number): void {
    run('UPDATE behaviours SET active = 0 WHERE id = ?', [id]);
    saveDb();
  },
};

// ── Rewards ───────────────────────────────────────────────────────────────────

export const rewardsRepo = {
  list(): Reward[] {
    return many<Reward>('SELECT * FROM rewards WHERE active = 1 ORDER BY cost');
  },
  add(name: string, cost: number, icon?: string): Reward {
    run('INSERT INTO rewards (name, cost, icon) VALUES (?, ?, ?)', [name, cost, icon ?? '🎁']);
    const id = lastInsertId();
    saveDb();
    return one<Reward>('SELECT * FROM rewards WHERE id = ?', [id])!;
  },
  update(id: number, patch: Partial<Pick<Reward, 'name' | 'cost' | 'icon'>>): Reward {
    const current = one<Reward>('SELECT * FROM rewards WHERE id = ?', [id])!;
    const merged = { ...current, ...patch };
    run('UPDATE rewards SET name = ?, cost = ?, icon = ? WHERE id = ?', [
      merged.name, merged.cost, merged.icon, id,
    ]);
    saveDb();
    return one<Reward>('SELECT * FROM rewards WHERE id = ?', [id])!;
  },
  remove(id: number): void {
    run('UPDATE rewards SET active = 0 WHERE id = ?', [id]);
    saveDb();
  },
  redeem(
    childId: number,
    rewardId: number
  ): { ok: boolean; message?: string; balance?: number } {
    const reward = one<Reward>('SELECT * FROM rewards WHERE id = ?', [rewardId]);
    if (!reward) return { ok: false, message: 'Reward not found' };
    const balance = pointsRepo.balance(childId);
    const MIN_REDEEM_BALANCE = 100;
    if (balance < MIN_REDEEM_BALANCE) {
      return { ok: false, message: `Need at least ${MIN_REDEEM_BALANCE} points to redeem any reward`, balance };
    }
    if (balance < reward.cost) return { ok: false, message: 'Not enough points yet', balance };
    // Block redemption while any consequence is still active
    const activeConsequenceCount = one<{ c: number }>(
      `SELECT COUNT(*) AS c FROM child_consequences
       WHERE child_id = ? AND resolved = 0
         AND (expires_at IS NULL OR expires_at > datetime('now'))`,
      [childId]
    );
    if ((activeConsequenceCount?.c ?? 0) > 0) {
      return {
        ok: false,
        message: 'Cannot redeem rewards while a consequence is active — a parent must lift it first',
        balance,
      };
    }
    // fulfilled defaults to 0 (pending) — parent marks it fulfilled later
    run(
      'INSERT INTO history (child_id, delta, reason, kind, reward_id, fulfilled) VALUES (?, ?, ?, ?, ?, 0)',
      [childId, -reward.cost, `Redeemed: ${reward.name}`, 'reward', rewardId]
    );
    saveDb();
    return { ok: true, balance: balance - reward.cost };
  },
};

// ── Points / history ──────────────────────────────────────────────────────────

export const pointsRepo = {
  balance(childId: number): number {
    const row = one<{ total: number }>(
      'SELECT COALESCE(SUM(delta), 0) AS total FROM history WHERE child_id = ?',
      [childId]
    );
    return row?.total ?? 0;
  },
  applyBehaviour(
    childId: number,
    behaviourId: number
  ): { balance: number; delta: number; milestone: boolean; consequenceTriggered: boolean; historyId: number; capped?: boolean } {
    const b = one<Behaviour>('SELECT * FROM behaviours WHERE id = ?', [behaviourId]);
    if (!b) throw new Error('Behaviour not found');

    // ── Daily limit check ────────────────────────────────────────────────────
    if (b.daily_limit > 0 && b.kind === 'positive') {
      const todayCount = one<{ c: number }>(
        `SELECT COUNT(*) AS c FROM history
         WHERE child_id = ? AND behaviour_id = ? AND date(created_at) = date('now')`,
        [childId, behaviourId]
      );
      if ((todayCount?.c ?? 0) >= b.daily_limit) {
        return { balance: this.balance(childId), delta: 0, milestone: false, consequenceTriggered: false, historyId: 0, capped: true };
      }
    }

    // ── Daily points cap check ───────────────────────────────────────────────
    const settings = settingsRepo.get();
    if (settings.max_points_per_day > 0 && b.kind === 'positive') {
      const earnedToday = one<{ total: number }>(
        `SELECT COALESCE(SUM(delta), 0) AS total FROM history
         WHERE child_id = ? AND delta > 0 AND date(created_at) = date('now')`,
        [childId]
      );
      if ((earnedToday?.total ?? 0) >= settings.max_points_per_day) {
        return { balance: this.balance(childId), delta: 0, milestone: false, consequenceTriggered: false, historyId: 0, capped: true };
      }
    }

    const before = this.balance(childId);
    run(
      'INSERT INTO history (child_id, delta, reason, kind, behaviour_id) VALUES (?, ?, ?, ?, ?)',
      [childId, b.points, b.name, b.kind, behaviourId]
    );
    const historyId = lastInsertId();
    const after = before + b.points;

    const child = one<{ goal_points: number; consequence_threshold: number }>(
      'SELECT goal_points, consequence_threshold FROM children WHERE id = ?',
      [childId]
    );
    const goal = Math.max(1, child?.goal_points ?? 100);
    const threshold = child?.consequence_threshold ?? 0;

    // Milestone: crossed a new multiple of goal going upward
    const milestone = Math.floor(after / goal) > Math.floor(before / goal) && after > 0;

    // Consequence: balance just dropped to/below threshold (was above before)
    const consequenceTriggered =
      threshold > 0 && before > threshold && after <= threshold;

    saveDb();
    return { balance: after, delta: b.points, milestone, consequenceTriggered, historyId };
  },
  manualAdjust(childId: number, delta: number, reason: string): { balance: number } {
    run('INSERT INTO history (child_id, delta, reason, kind) VALUES (?, ?, ?, ?)', [
      childId, delta, reason, 'manual',
    ]);
    saveDb();
    return { balance: this.balance(childId) };
  },
};

// ── Pending behaviour approvals ───────────────────────────────────────────────

const PENDING_JOIN = `
  pb.*,
  ch.name         AS child_name,
  ch.avatar_emoji AS child_avatar,
  b.name          AS behaviour_name,
  b.icon          AS behaviour_icon,
  b.points        AS behaviour_points,
  b.kind          AS behaviour_kind
`;

export const pendingRepo = {
  list(): PendingBehaviour[] {
    return many<PendingBehaviour>(
      `SELECT ${PENDING_JOIN}
       FROM pending_behaviours pb
       JOIN children  ch ON ch.id = pb.child_id
       JOIN behaviours b  ON  b.id = pb.behaviour_id
       ORDER BY pb.created_at`
    );
  },
  count(): number {
    const row = one<{ c: number }>('SELECT COUNT(*) AS c FROM pending_behaviours');
    return row?.c ?? 0;
  },
  add(childId: number, behaviourId: number): PendingBehaviour {
    run(
      'INSERT INTO pending_behaviours (child_id, behaviour_id) VALUES (?, ?)',
      [childId, behaviourId]
    );
    const id = lastInsertId();
    saveDb();
    return one<PendingBehaviour>(
      `SELECT ${PENDING_JOIN}
       FROM pending_behaviours pb
       JOIN children  ch ON ch.id = pb.child_id
       JOIN behaviours b  ON  b.id = pb.behaviour_id
       WHERE pb.id = ?`,
      [id]
    )!;
  },
  approve(id: number): { balance: number; delta: number; milestone: boolean; consequenceTriggered: boolean } {
    const row = one<{ child_id: number; behaviour_id: number }>(
      'SELECT child_id, behaviour_id FROM pending_behaviours WHERE id = ?',
      [id]
    );
    if (!row) throw new Error('Pending behaviour not found');
    // Apply the points (reuses all the existing milestone / consequence logic)
    const result = pointsRepo.applyBehaviour(row.child_id, row.behaviour_id);
    // Remove from the queue
    run('DELETE FROM pending_behaviours WHERE id = ?', [id]);
    saveDb();
    return result;
  },
  reject(id: number): void {
    run('DELETE FROM pending_behaviours WHERE id = ?', [id]);
    saveDb();
  },
  rejectAll(): void {
    run('DELETE FROM pending_behaviours');
    saveDb();
  },
  approveAll(): Array<{ balance: number; delta: number; milestone: boolean; consequenceTriggered: boolean }> {
    const all = this.list();
    const results = [];
    for (const pb of all) {
      const result = pointsRepo.applyBehaviour(pb.child_id, pb.behaviour_id);
      results.push(result);
    }
    run('DELETE FROM pending_behaviours');
    saveDb();
    return results;
  },
};

// Converts a SQLite UTC datetime string to a local YYYY-MM-DD string
function utcToLocalDateStr(utc: string): string {
  // SQLite stores datetime('now') as 'YYYY-MM-DD HH:MM:SS' (no timezone marker) — treat as UTC
  const d = new Date(utc.replace(' ', 'T') + 'Z');
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const historyRepo = {
  /**
   * Returns the number of consecutive calendar days (in local time) on which
   * at least one positive-delta history entry was recorded for this child.
   * The streak is "alive" if today OR yesterday has an entry; otherwise 0.
   */
  getStreak(childId: number): number {
    // Fetch recent positive entries — 366 rows is more than enough for a year streak
    const rows = many<{ created_at: string }>(
      `SELECT created_at FROM history
       WHERE child_id = ? AND delta > 0
       ORDER BY created_at DESC
       LIMIT 366`,
      [childId]
    );

    if (rows.length === 0) return 0;

    // Deduplicate into a sorted set of local date strings (descending)
    const days = Array.from(
      new Set(rows.map((r) => utcToLocalDateStr(r.created_at)))
    ).sort((a, b) => (a > b ? -1 : 1));

    const today     = localDateStr(new Date());
    const yesterday = localDateStr(new Date(Date.now() - 86_400_000));

    // Streak must include today or yesterday to be considered alive
    if (days[0] !== today && days[0] !== yesterday) return 0;

    let streak = 1;
    for (let i = 1; i < days.length; i++) {
      // Calculate expected "previous" day
      const prevDate = new Date(days[i - 1] + 'T00:00:00');
      prevDate.setDate(prevDate.getDate() - 1);
      const expected = localDateStr(prevDate);
      if (days[i] === expected) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  },

  list(opts: { childId?: number; fromIso?: string; toIso?: string } = {}): HistoryEntry[] {
    const clauses: string[] = [];
    const params: Array<string | number> = [];
    if (opts.childId) { clauses.push('child_id = ?'); params.push(opts.childId); }
    if (opts.fromIso) { clauses.push('created_at >= ?'); params.push(opts.fromIso); }
    if (opts.toIso)   { clauses.push('created_at <= ?'); params.push(opts.toIso); }
    const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
    return many<HistoryEntry>(
      `SELECT * FROM history ${where} ORDER BY created_at DESC LIMIT 500`,
      params
    );
  },
  getClaimedRewards(childId: number): HistoryEntry[] {
    return many<HistoryEntry>(
      `SELECT h.*, r.name AS reward_name, r.icon AS reward_icon
       FROM history h
       LEFT JOIN rewards r ON r.id = h.reward_id
       WHERE h.child_id = ? AND h.kind = 'reward'
       ORDER BY h.created_at DESC`,
      [childId]
    );
  },
  markFulfilled(historyId: number): void {
    run('UPDATE history SET fulfilled = 1 WHERE id = ?', [historyId]);
    saveDb();
  },

  /**
   * Reverse a history entry: deletes the row so balance auto-corrects.
   * Returns the new balance for the affected child.
   */
  undoEntry(historyId: number): { balance: number } {
    const row = one<{ child_id: number }>('SELECT child_id FROM history WHERE id = ?', [historyId]);
    if (!row) throw new Error('History entry not found');
    run('DELETE FROM history WHERE id = ?', [historyId]);
    saveDb();
    return { balance: pointsRepo.balance(row.child_id) };
  },

  updateNote(historyId: number, note: string): void {
    run('UPDATE history SET note = ? WHERE id = ?', [note.trim(), historyId]);
    saveDb();
  },

  /**
   * Returns ALL history rows for the given child (no LIMIT) joined with the
   * child's name and avatar, suitable for CSV export.
   */
  exportForChild(childId: number): Array<HistoryEntry & { child_name: string; child_avatar: string }> {
    return many<HistoryEntry & { child_name: string; child_avatar: string }>(
      `SELECT h.*, c.name AS child_name, c.avatar_emoji AS child_avatar
       FROM history h
       JOIN children c ON c.id = h.child_id
       WHERE h.child_id = ?
       ORDER BY h.created_at ASC`,
      [childId]
    );
  },

  /**
   * Returns ALL history rows for ALL children joined with child name/avatar.
   */
  exportAll(): Array<HistoryEntry & { child_name: string; child_avatar: string }> {
    return many<HistoryEntry & { child_name: string; child_avatar: string }>(
      `SELECT h.*, c.name AS child_name, c.avatar_emoji AS child_avatar
       FROM history h
       JOIN children c ON c.id = h.child_id
       ORDER BY h.created_at ASC`
    );
  },

  /**
   * Returns daily running balance for a child over the last N days.
   * Each row: { day: 'YYYY-MM-DD', balance: number }
   */
  getBalanceOverTime(childId: number, days = 30): Array<{ day: string; balance: number }> {
    // Get all entries ordered ascending, compute running sum per day
    const raw = many<{ day: string; net: number }>(
      `SELECT date(created_at) AS day, SUM(delta) AS net
       FROM history
       WHERE child_id = ?
         AND date(created_at) >= date('now', '-${Math.max(1, days) - 1} days')
       GROUP BY day
       ORDER BY day ASC`,
      [childId]
    );
    // Compute balance before the window
    const priorBalance = one<{ total: number }>(
      `SELECT COALESCE(SUM(delta), 0) AS total FROM history
       WHERE child_id = ? AND date(created_at) < date('now', '-${Math.max(1, days) - 1} days')`,
      [childId]
    );
    let running = priorBalance?.total ?? 0;
    return raw.map((r) => {
      running += r.net;
      return { day: r.day, balance: running };
    });
  },
};

// ── Per-child behaviour excludes ─────────────────────────────────────────────

export const childBehaviourExcludesRepo = {
  /** Returns the set of behaviour IDs hidden from this child. */
  getForChild(childId: number): number[] {
    return many<{ behaviour_id: number }>(
      'SELECT behaviour_id FROM child_behaviour_excludes WHERE child_id = ?',
      [childId]
    ).map((r) => r.behaviour_id);
  },
  /** Toggle visibility: if excluded → show; if visible → hide. Returns new excluded set. */
  toggle(childId: number, behaviourId: number): number[] {
    const exists = one<{ c: number }>(
      'SELECT COUNT(*) AS c FROM child_behaviour_excludes WHERE child_id = ? AND behaviour_id = ?',
      [childId, behaviourId]
    );
    if ((exists?.c ?? 0) > 0) {
      run('DELETE FROM child_behaviour_excludes WHERE child_id = ? AND behaviour_id = ?', [childId, behaviourId]);
    } else {
      run('INSERT OR IGNORE INTO child_behaviour_excludes (child_id, behaviour_id) VALUES (?, ?)', [childId, behaviourId]);
    }
    saveDb();
    return this.getForChild(childId);
  },
};

// ── Consequences ──────────────────────────────────────────────────────────────

export const consequencesRepo = {
  list(): Consequence[] {
    return many<Consequence>(
      'SELECT * FROM consequences WHERE active = 1 ORDER BY created_at'
    );
  },
  add(name: string, icon: string, description: string): Consequence {
    run(
      'INSERT INTO consequences (name, icon, description) VALUES (?, ?, ?)',
      [name, icon, description]
    );
    const id = lastInsertId();
    saveDb();
    return one<Consequence>('SELECT * FROM consequences WHERE id = ?', [id])!;
  },
  update(id: number, patch: { name?: string; icon?: string; description?: string }): Consequence {
    if (patch.name !== undefined)
      run('UPDATE consequences SET name = ? WHERE id = ?', [patch.name, id]);
    if (patch.icon !== undefined)
      run('UPDATE consequences SET icon = ? WHERE id = ?', [patch.icon, id]);
    if (patch.description !== undefined)
      run('UPDATE consequences SET description = ? WHERE id = ?', [patch.description, id]);
    saveDb();
    return one<Consequence>('SELECT * FROM consequences WHERE id = ?', [id])!;
  },
  remove(id: number): void {
    run('UPDATE consequences SET active = 0 WHERE id = ?', [id]);
    saveDb();
  },
};

// ── Child Consequence Assignments ─────────────────────────────────────────────

const ACTIVE_FILTER = `resolved = 0 AND (expires_at IS NULL OR expires_at > datetime('now'))`;

const JOIN_FIELDS = `
  cc.*,
  c.name  AS consequence_name,
  c.icon  AS consequence_icon,
  c.description AS consequence_description,
  ch.name AS child_name,
  ch.avatar_emoji AS child_avatar
`;

export const childConsequencesRepo = {
  assign(
    childId: number,
    consequenceId: number,
    durationDays: number,
    note = ''
  ): AssignedConsequence {
    const expiresAt =
      durationDays > 0
        ? one<{ ts: string }>(
            `SELECT datetime('now', '+${durationDays} days') AS ts`
          )?.ts ?? null
        : null;

    run(
      `INSERT INTO child_consequences
         (child_id, consequence_id, duration_days, expires_at, note)
       VALUES (?, ?, ?, ?, ?)`,
      [childId, consequenceId, durationDays, expiresAt, note]
    );
    const id = lastInsertId();
    saveDb();
    return this._getById(id)!;
  },

  resolve(id: number): void {
    run(
      `UPDATE child_consequences SET resolved = 1, resolved_at = datetime('now') WHERE id = ?`,
      [id]
    );
    saveDb();
  },

  getActiveForChild(childId: number): AssignedConsequence[] {
    return many<AssignedConsequence>(
      `SELECT ${JOIN_FIELDS}
       FROM child_consequences cc
       JOIN consequences c  ON c.id  = cc.consequence_id
       JOIN children    ch ON ch.id = cc.child_id
       WHERE cc.child_id = ? AND cc.${ACTIVE_FILTER}
       ORDER BY cc.assigned_at`,
      [childId]
    );
  },

  getAllActive(): AssignedConsequence[] {
    return many<AssignedConsequence>(
      `SELECT ${JOIN_FIELDS}
       FROM child_consequences cc
       JOIN consequences c  ON c.id  = cc.consequence_id
       JOIN children    ch ON ch.id = cc.child_id
       WHERE cc.${ACTIVE_FILTER}
       ORDER BY ch.name, cc.assigned_at`
    );
  },

  _getById(id: number): AssignedConsequence | undefined {
    return one<AssignedConsequence>(
      `SELECT ${JOIN_FIELDS}
       FROM child_consequences cc
       JOIN consequences c  ON c.id  = cc.consequence_id
       JOIN children    ch ON ch.id = cc.child_id
       WHERE cc.id = ?`,
      [id]
    );
  },
};

// ── Reports ───────────────────────────────────────────────────────────────────

export type SiblingSnapshot = {
  child_id: number;
  child_name: string;
  child_avatar: string;
  theme_color: string;
  balance: number;
  earned_this_week: number;
  streak: number;
};

export const reportsRepo = {
  /** Snapshot comparing all active children for the leaderboard/sibling view. */
  getSiblingComparison(): SiblingSnapshot[] {
    const children = many<{ id: number; name: string; avatar_emoji: string; theme_color: string }>(
      "SELECT id, name, avatar_emoji, theme_color FROM children WHERE archived = 0 ORDER BY created_at"
    );
    return children.map((c) => {
      const balance = pointsRepo.balance(c.id);
      const earnedRow = one<{ total: number }>(
        `SELECT COALESCE(SUM(delta), 0) AS total FROM history
         WHERE child_id = ? AND delta > 0 AND date(created_at) >= date('now', '-6 days')`,
        [c.id]
      );
      const streak = historyRepo.getStreak(c.id);
      return {
        child_id: c.id,
        child_name: c.name,
        child_avatar: c.avatar_emoji,
        theme_color: c.theme_color,
        balance,
        earned_this_week: earnedRow?.total ?? 0,
        streak,
      };
    });
  },

  /**
   * @param days  Number of days to look back. Pass 0 for all-time.
   */
  getBehaviourTrend(childId: number, reason: string, days = 14) {
    const dateFilter = days === 0 ? '' : `AND date(created_at) >= date('now', '-${days - 1} days')`;

    const daily = many<{ day: string; count: number; delta: number }>(
      `SELECT date(created_at) AS day,
              COUNT(*) AS count,
              SUM(delta) AS delta
       FROM history
       WHERE child_id = ? AND reason = ? ${dateFilter}
       GROUP BY day
       ORDER BY day`,
      [childId, reason]
    );

    const totals = one<{ count: number; delta: number }>(
      `SELECT COUNT(*) AS count, SUM(delta) AS delta
       FROM history WHERE child_id = ? AND reason = ? ${dateFilter}`,
      [childId, reason]
    );

    const peak = daily.reduce(
      (best, d) => (d.count > best.count ? d : best),
      { day: '', count: 0, delta: 0 }
    );

    return {
      daily,
      totalCount: totals?.count ?? 0,
      totalDelta: totals?.delta ?? 0,
      peakDay: peak.day || null,
      peakCount: peak.count,
    };
  },

  summary(childId: number, days = 14) {
    const allTime = days === 0;
    const dateFilter = allTime ? '' : `AND date(created_at) >= date('now', '-${days - 1} days')`;

    const daily = many<{ day: string; earned: number; deducted: number }>(
      `SELECT date(created_at) AS day,
              SUM(CASE WHEN delta > 0 THEN delta ELSE 0 END) AS earned,
              SUM(CASE WHEN delta < 0 THEN -delta ELSE 0 END) AS deducted
       FROM history
       WHERE child_id = ? ${dateFilter}
       GROUP BY day
       ORDER BY day`,
      [childId]
    );

    const frequent = many<{ reason: string; count: number; total_delta: number }>(
      `SELECT reason, COUNT(*) AS count, SUM(delta) AS total_delta
       FROM history
       WHERE child_id = ? AND kind IN ('positive','negative') ${dateFilter}
       GROUP BY reason
       ORDER BY count DESC
       LIMIT 8`,
      [childId]
    );

    // Summary totals
    const totals = one<{ earned: number; deducted: number }>(
      `SELECT
         SUM(CASE WHEN delta > 0 THEN delta ELSE 0 END) AS earned,
         SUM(CASE WHEN delta < 0 THEN -delta ELSE 0 END) AS deducted
       FROM history
       WHERE child_id = ? ${dateFilter}`,
      [childId]
    );

    // Rewards claimed count
    const claimedRow = one<{ c: number }>(
      `SELECT COUNT(*) AS c FROM history
       WHERE child_id = ? AND kind = 'reward' ${dateFilter}`,
      [childId]
    );

    // Top claimed rewards
    const topClaimedRewards = many<{ reason: string; count: number }>(
      `SELECT reason, COUNT(*) AS count
       FROM history
       WHERE child_id = ? AND kind = 'reward' ${dateFilter}
       GROUP BY reason
       ORDER BY count DESC
       LIMIT 5`,
      [childId]
    );

    const balance = pointsRepo.balance(childId);

    return {
      daily,
      frequent,
      balance,
      totalEarned: totals?.earned ?? 0,
      totalDeducted: totals?.deducted ?? 0,
      totalRewardsClaimed: claimedRow?.c ?? 0,
      topClaimedRewards,
    };
  },
};
