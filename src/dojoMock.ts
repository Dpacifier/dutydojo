/**
 * dojoMock.ts — in-memory implementation of window.dojo for browser / mobile preview.
 * All data lives in module-level arrays and resets on page refresh.
 */

import type {
  Child, Behaviour, Reward, Consequence, AssignedConsequence,
  HistoryEntry, HistoryExportRow, ParentSettings, PendingBehaviour,
  ReportSummary, BehaviourTrend, SiblingSnapshot,
} from './types';

// ── ID generator ──────────────────────────────────────────────────────────────

let _seq = 1;
const nextId = () => _seq++;

// ── In-memory state ───────────────────────────────────────────────────────────

let _parentSetup = false;
let _parentPassword = '';
let _recoveryQuestion: string | null = null;
let _recoveryAnswer: string | null = null;
let _kidPin: string | null = null;

let _settings: ParentSettings = {
  default_start_points: 0,
  default_goal_points: 100,
  default_threshold: 0,
  require_approval: 0,
  max_points_per_day: 0,
};

let _children: Child[] = [];
let _behaviours: Behaviour[] = [];
let _rewards: Reward[] = [];
let _consequences: Consequence[] = [];
let _assigned: AssignedConsequence[] = [];
let _history: HistoryEntry[] = [];
let _pending: PendingBehaviour[] = [];
let _excludes: Array<{ child_id: number; behaviour_id: number }> = [];

// ── Seed data ─────────────────────────────────────────────────────────────────

function seed() {
  const emma: Child = {
    id: nextId(), name: 'Emma', avatar_emoji: '🦄',
    goal_points: 100, consequence_threshold: 20,
    archived: 0, notes: '', theme_color: '#8b5cf6',
    created_at: iso(),
  };
  const liam: Child = {
    id: nextId(), name: 'Liam', avatar_emoji: '🐯',
    goal_points: 100, consequence_threshold: 20,
    archived: 0, notes: '', theme_color: '#f59e0b',
    created_at: iso(),
  };
  _children = [emma, liam];

  _behaviours = [
    { id: nextId(), name: 'Did homework',       kind: 'positive', points: 10, icon: '📚', active: 1, daily_limit: 1, category: 'School'  },
    { id: nextId(), name: 'Helped with dinner', kind: 'positive', points: 8,  icon: '🍳', active: 1, daily_limit: 1, category: 'Chores'  },
    { id: nextId(), name: 'Tidied bedroom',     kind: 'positive', points: 5,  icon: '🧹', active: 1, daily_limit: 1, category: 'Chores'  },
    { id: nextId(), name: 'Was kind',           kind: 'positive', points: 5,  icon: '❤️', active: 1, daily_limit: 0, category: 'Social'  },
    { id: nextId(), name: 'Read for 20 mins',   kind: 'positive', points: 8,  icon: '📖', active: 1, daily_limit: 2, category: 'School'  },
    { id: nextId(), name: 'Rude to sibling',    kind: 'negative', points: -8, icon: '😤', active: 1, daily_limit: 0, category: 'Social'  },
    { id: nextId(), name: 'Refused a chore',    kind: 'negative', points: -5, icon: '🙅', active: 1, daily_limit: 0, category: 'Chores'  },
    { id: nextId(), name: 'Screen past bedtime',kind: 'negative', points: -10,icon: '📵', active: 1, daily_limit: 0, category: 'General' },
  ];

  _rewards = [
    { id: nextId(), name: 'Movie night pick',  cost: 50, icon: '🎬', active: 1 },
    { id: nextId(), name: 'Ice cream trip',    cost: 80, icon: '🍦', active: 1 },
    { id: nextId(), name: 'Stay up 30 mins',   cost: 40, icon: '🌙', active: 1 },
    { id: nextId(), name: 'Board game choice', cost: 30, icon: '🎲', active: 1 },
  ];

  _consequences = [
    { id: nextId(), name: 'No video games', icon: '🎮', description: 'No gaming for the duration', active: 1, created_at: iso() },
    { id: nextId(), name: 'Early bedtime',  icon: '🛏️', description: '30 minutes earlier than usual', active: 1, created_at: iso() },
    { id: nextId(), name: 'No screen time', icon: '📵', description: 'No TV, tablet, or phone', active: 1, created_at: iso() },
    { id: nextId(), name: 'Extra chore',    icon: '🧹', description: 'One extra household task', active: 1, created_at: iso() },
  ];

  // Seed history for Emma (balance ≈ 45)
  const bh = _behaviours[0];
  for (let i = 5; i >= 1; i--) {
    _history.push({ id: nextId(), child_id: emma.id, delta: 10, reason: bh.name, kind: 'positive', behaviour_id: bh.id, reward_id: null, fulfilled: 0, note: '', created_at: daysAgo(i) });
  }
  _history.push({ id: nextId(), child_id: emma.id, delta: -5, reason: _behaviours[6].name, kind: 'negative', behaviour_id: _behaviours[6].id, reward_id: null, fulfilled: 0, note: '', created_at: daysAgo(1) });

  // Seed history for Liam (balance ≈ 30)
  for (let i = 3; i >= 1; i--) {
    _history.push({ id: nextId(), child_id: liam.id, delta: 10, reason: bh.name, kind: 'positive', behaviour_id: bh.id, reward_id: null, fulfilled: 0, note: '', created_at: daysAgo(i) });
  }
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function iso(d: Date = new Date()): string {
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return iso(d);
}

// ── Balance helper ────────────────────────────────────────────────────────────

function balance(childId: number): number {
  return _history.filter((h) => h.child_id === childId).reduce((s, h) => s + h.delta, 0);
}

// ── Mock API ──────────────────────────────────────────────────────────────────

export function installMock() {
  const mock = {
    // ── Auth ──────────────────────────────────────────────────────────────────
    isSetup: async () => _parentSetup,
    setupParent: async ({ name: _n, password }: { name: string; password: string }) => {
      _parentPassword = password; _parentSetup = true; return true;
    },
    verifyParent: async (password: string) => password === _parentPassword,
    changeParentPassword: async ({ oldPassword, newPassword }: { oldPassword: string; newPassword: string }) => {
      if (oldPassword !== _parentPassword) return false;
      _parentPassword = newPassword; return true;
    },
    hasRecovery: async () => _recoveryQuestion !== null,
    getRecoveryQuestion: async () => _recoveryQuestion,
    setRecovery: async ({ question, answer }: { question: string; answer: string }) => {
      _recoveryQuestion = question; _recoveryAnswer = answer.toLowerCase().trim();
    },
    verifyRecoveryAndReset: async ({ answer, newPassword }: { answer: string; newPassword: string }) => {
      if (answer.toLowerCase().trim() !== _recoveryAnswer) return false;
      _parentPassword = newPassword; return true;
    },
    // Kid PIN
    hasKidPin: async () => _kidPin !== null,
    setKidPin: async (pin: string) => { _kidPin = pin; return true; },
    verifyKidPin: async (pin: string) => _kidPin === null || pin === _kidPin,
    clearKidPin: async () => { _kidPin = null; return true; },

    // ── Settings ──────────────────────────────────────────────────────────────
    getSettings: async () => ({ ..._settings }),
    saveSettings: async (s: ParentSettings) => { _settings = { ...s }; return true; },

    // ── Children ──────────────────────────────────────────────────────────────
    listChildren: async () => _children.filter((c) => !c.archived),
    listAllChildren: async () => [..._children],
    addChild: async (p: {
      name: string; avatarEmoji?: string; goalPoints?: number;
      consequenceThreshold?: number; initialPoints?: number; themeColor?: string;
    }) => {
      const child: Child = {
        id: nextId(), name: p.name,
        avatar_emoji: p.avatarEmoji ?? '🥋',
        goal_points: p.goalPoints ?? _settings.default_goal_points,
        consequence_threshold: p.consequenceThreshold ?? _settings.default_threshold,
        archived: 0, notes: '',
        theme_color: p.themeColor ?? '#6366f1',
        created_at: iso(),
      };
      _children.push(child);
      if (p.initialPoints && p.initialPoints > 0) {
        _history.push({ id: nextId(), child_id: child.id, delta: p.initialPoints, reason: 'Starting points', kind: 'manual', behaviour_id: null, reward_id: null, fulfilled: 0, note: '', created_at: iso() });
      }
      return child;
    },
    updateChild: async (p: {
      id: number; name?: string; avatarEmoji?: string;
      goalPoints?: number; consequenceThreshold?: number; notes?: string; themeColor?: string;
    }) => {
      const c = _children.find((x) => x.id === p.id)!;
      if (p.name !== undefined) c.name = p.name;
      if (p.avatarEmoji !== undefined) c.avatar_emoji = p.avatarEmoji;
      if (p.goalPoints !== undefined) c.goal_points = p.goalPoints;
      if (p.consequenceThreshold !== undefined) c.consequence_threshold = p.consequenceThreshold;
      if (p.notes !== undefined) c.notes = p.notes;
      if (p.themeColor !== undefined) c.theme_color = p.themeColor;
      return { ...c };
    },
    archiveChild: async (id: number) => {
      const c = _children.find((x) => x.id === id);
      if (c) c.archived = 1;
      return true;
    },
    unarchiveChild: async (id: number) => {
      const c = _children.find((x) => x.id === id);
      if (c) c.archived = 0;
      return true;
    },
    deleteChild: async (id: number) => {
      _children = _children.filter((c) => c.id !== id);
      _history = _history.filter((h) => h.child_id !== id);
      _assigned = _assigned.filter((a) => a.child_id !== id);
      _pending  = _pending.filter((p) => p.child_id !== id);
      _excludes = _excludes.filter((e) => e.child_id !== id);
      return true;
    },

    // ── Behaviours ────────────────────────────────────────────────────────────
    listBehaviours: async () => _behaviours.filter((b) => b.active === 1),
    listAllBehaviours: async () => [..._behaviours],
    addBehaviour: async (p: { name: string; kind: 'positive' | 'negative'; points: number; icon?: string; dailyLimit?: number; category?: string }) => {
      const b: Behaviour = { id: nextId(), ...p, icon: p.icon ?? '⭐', active: 1, daily_limit: p.dailyLimit ?? 0, category: p.category ?? '' };
      _behaviours.push(b);
      return b;
    },
    updateBehaviour: async (p: { id: number; name?: string; kind?: 'positive' | 'negative'; points?: number; icon?: string; daily_limit?: number; category?: string }) => {
      const b = _behaviours.find((x) => x.id === p.id)!;
      if (p.name !== undefined) b.name = p.name;
      if (p.kind !== undefined) b.kind = p.kind;
      if (p.points !== undefined) b.points = p.points;
      if (p.icon !== undefined) b.icon = p.icon;
      if (p.daily_limit !== undefined) b.daily_limit = p.daily_limit;
      if (p.category !== undefined) b.category = p.category;
      return { ...b };
    },
    setBehaviourActive: async ({ id, active }: { id: number; active: 0 | 1 }) => {
      const b = _behaviours.find((x) => x.id === id)!;
      b.active = active; return true;
    },
    deleteBehaviour: async (id: number) => {
      _behaviours = _behaviours.filter((b) => b.id !== id);
      _excludes   = _excludes.filter((e) => e.behaviour_id !== id);
      return true;
    },

    // ── Rewards ───────────────────────────────────────────────────────────────
    listRewards: async () => _rewards.filter((r) => r.active === 1),
    addReward: async (p: { name: string; cost: number; icon?: string }) => {
      const r: Reward = { id: nextId(), ...p, icon: p.icon ?? '🎁', active: 1 };
      _rewards.push(r); return r;
    },
    updateReward: async (p: { id: number; name?: string; cost?: number; icon?: string }) => {
      const r = _rewards.find((x) => x.id === p.id)!;
      if (p.name !== undefined) r.name = p.name;
      if (p.cost !== undefined) r.cost = p.cost;
      if (p.icon !== undefined) r.icon = p.icon;
      return { ...r };
    },
    deleteReward: async (id: number) => { _rewards = _rewards.filter((r) => r.id !== id); return true; },
    redeemReward: async ({ childId, rewardId }: { childId: number; rewardId: number }) => {
      const MIN = 100;
      const r = _rewards.find((x) => x.id === rewardId);
      if (!r) return { ok: false, message: 'Reward not found' };
      const bal = balance(childId);
      if (bal < MIN) return { ok: false, message: `Need at least ${MIN} points to redeem` };
      if (bal < r.cost) return { ok: false, message: `Not enough points (need ${r.cost})` };
      const hasConsequence = _assigned.some((a) => a.child_id === childId && !a.resolved);
      if (hasConsequence) return { ok: false, message: 'Child has active consequences' };
      _history.push({ id: nextId(), child_id: childId, delta: -r.cost, reason: `Redeemed: ${r.name}`, kind: 'reward', behaviour_id: null, reward_id: rewardId, fulfilled: 0, note: '', created_at: iso() });
      return { ok: true, balance: balance(childId) };
    },

    // ── Consequences (library) ────────────────────────────────────────────────
    listConsequences: async () => [..._consequences],
    addConsequence: async (p: { name: string; icon: string; description: string }) => {
      const c: Consequence = { id: nextId(), ...p, active: 1, created_at: iso() };
      _consequences.push(c); return c;
    },
    updateConsequence: async (p: { id: number; name?: string; icon?: string; description?: string }) => {
      const c = _consequences.find((x) => x.id === p.id)!;
      if (p.name !== undefined) c.name = p.name;
      if (p.icon !== undefined) c.icon = p.icon;
      if (p.description !== undefined) c.description = p.description;
      return { ...c };
    },
    deleteConsequence: async (id: number) => {
      _consequences = _consequences.filter((c) => c.id !== id);
      _assigned     = _assigned.filter((a) => a.consequence_id !== id);
      return true;
    },

    // ── Consequence assignments ───────────────────────────────────────────────
    assignConsequence: async (p: { childId: number; consequenceId: number; durationDays: number; note?: string }) => {
      const child = _children.find((c) => c.id === p.childId)!;
      const cons  = _consequences.find((c) => c.id === p.consequenceId)!;
      const expiresAt = p.durationDays > 0 ? iso(new Date(Date.now() + p.durationDays * 86_400_000)) : null;
      const ac: AssignedConsequence = {
        id: nextId(), child_id: p.childId, consequence_id: p.consequenceId,
        duration_days: p.durationDays, assigned_at: iso(), expires_at: expiresAt,
        resolved: 0, resolved_at: null, note: p.note ?? '',
        consequence_name: cons.name, consequence_icon: cons.icon, consequence_description: cons.description,
        child_name: child.name, child_avatar: child.avatar_emoji,
      };
      _assigned.push(ac); return ac;
    },
    resolveConsequence: async (id: number) => {
      const ac = _assigned.find((a) => a.id === id);
      if (ac) { ac.resolved = 1; ac.resolved_at = iso(); }
      return true;
    },
    getActiveConsequencesForChild: async (childId: number) =>
      _assigned.filter((a) => a.child_id === childId && !a.resolved),
    getAllActiveConsequences: async () => _assigned.filter((a) => !a.resolved),

    // ── Pending approvals ─────────────────────────────────────────────────────
    listPending: async () => [..._pending],
    countPending: async () => _pending.length,
    addPending: async ({ childId, behaviourId }: { childId: number; behaviourId: number }) => {
      const child = _children.find((c) => c.id === childId)!;
      const b     = _behaviours.find((x) => x.id === behaviourId)!;
      const p: PendingBehaviour = {
        id: nextId(), child_id: childId, behaviour_id: behaviourId, created_at: iso(),
        child_name: child.name, child_avatar: child.avatar_emoji,
        behaviour_name: b.name, behaviour_icon: b.icon,
        behaviour_points: b.points, behaviour_kind: b.kind,
      };
      _pending.push(p); return p;
    },
    approvePending: async (id: number) => {
      const p = _pending.find((x) => x.id === id);
      if (!p) return { balance: 0, delta: 0, milestone: false, consequenceTriggered: false };
      _pending = _pending.filter((x) => x.id !== id);
      _history.push({ id: nextId(), child_id: p.child_id, delta: p.behaviour_points, reason: p.behaviour_name, kind: p.behaviour_kind, behaviour_id: p.behaviour_id, reward_id: null, fulfilled: 0, note: '', created_at: iso() });
      const bal = balance(p.child_id);
      const child = _children.find((c) => c.id === p.child_id)!;
      const milestone = bal > 0 && bal % child.goal_points < p.behaviour_points;
      const ct = child.consequence_threshold > 0 && bal <= child.consequence_threshold;
      return { balance: bal, delta: p.behaviour_points, milestone, consequenceTriggered: ct };
    },
    rejectPending: async (id: number) => { _pending = _pending.filter((x) => x.id !== id); return true; },
    rejectAllPending: async () => { _pending = []; return true; },
    approveAllPending: async () => {
      const results = [];
      for (const p of _pending) {
        _history.push({ id: nextId(), child_id: p.child_id, delta: p.behaviour_points, reason: p.behaviour_name, kind: p.behaviour_kind, behaviour_id: p.behaviour_id, reward_id: null, fulfilled: 0, note: '', created_at: iso() });
        const bal = balance(p.child_id);
        const child = _children.find((c) => c.id === p.child_id)!;
        const milestone = bal > 0 && bal % child.goal_points < p.behaviour_points;
        const ct = child.consequence_threshold > 0 && bal <= child.consequence_threshold;
        results.push({ balance: bal, delta: p.behaviour_points, milestone, consequenceTriggered: ct });
      }
      _pending = [];
      return results;
    },

    // ── Points / history / reports ────────────────────────────────────────────
    applyBehaviour: async ({ childId, behaviourId }: { childId: number; behaviourId: number }) => {
      const b = _behaviours.find((x) => x.id === behaviourId)!;
      const child = _children.find((c) => c.id === childId)!;

      // Daily limit check (mock)
      if (b.daily_limit > 0 && b.kind === 'positive') {
        const today = new Date().toISOString().slice(0, 10);
        const todayCount = _history.filter((h) => h.child_id === childId && h.behaviour_id === behaviourId && h.created_at.slice(0, 10) === today).length;
        if (todayCount >= b.daily_limit) {
          return { balance: balance(childId), delta: 0, milestone: false, consequenceTriggered: false, historyId: 0, capped: true };
        }
      }

      // Daily cap check
      if (_settings.max_points_per_day > 0 && b.kind === 'positive') {
        const today = new Date().toISOString().slice(0, 10);
        const earnedToday = _history.filter((h) => h.child_id === childId && h.delta > 0 && h.created_at.slice(0, 10) === today).reduce((s, h) => s + h.delta, 0);
        if (earnedToday >= _settings.max_points_per_day) {
          return { balance: balance(childId), delta: 0, milestone: false, consequenceTriggered: false, historyId: 0, capped: true };
        }
      }

      const hId = nextId();
      _history.push({ id: hId, child_id: childId, delta: b.points, reason: b.name, kind: b.kind, behaviour_id: behaviourId, reward_id: null, fulfilled: 0, note: '', created_at: iso() });
      const bal = balance(childId);
      const prevBal = bal - b.points;
      const milestone = Math.floor(prevBal / child.goal_points) < Math.floor(bal / child.goal_points) && bal > 0;
      const ct = child.consequence_threshold > 0 && bal <= child.consequence_threshold && prevBal > child.consequence_threshold;
      return { balance: bal, delta: b.points, milestone, consequenceTriggered: ct, historyId: hId };
    },
    manualAdjust: async ({ childId, delta, reason }: { childId: number; delta: number; reason: string }) => {
      _history.push({ id: nextId(), child_id: childId, delta, reason, kind: 'manual', behaviour_id: null, reward_id: null, fulfilled: 0, note: '', created_at: iso() });
      return { balance: balance(childId) };
    },
    getChildPoints: async (childId: number) => balance(childId),
    getStreak: async (childId: number) => {
      const days = new Set(_history.filter((h) => h.child_id === childId && h.delta > 0).map((h) => h.created_at.slice(0, 10)));
      let streak = 0;
      const d = new Date();
      while (true) {
        const key = d.toISOString().slice(0, 10);
        if (!days.has(key)) break;
        streak++;
        d.setDate(d.getDate() - 1);
      }
      return streak;
    },
    getHistory: async ({ childId, fromIso, toIso }: { childId?: number; fromIso?: string; toIso?: string }) => {
      let rows = childId ? _history.filter((h) => h.child_id === childId) : [..._history];
      if (fromIso) rows = rows.filter((h) => h.created_at >= fromIso);
      if (toIso)   rows = rows.filter((h) => h.created_at <= toIso + ' 23:59:59');
      return [...rows].reverse();
    },
    getClaimedRewards: async (childId: number) =>
      _history.filter((h) => h.child_id === childId && h.kind === 'reward').slice().reverse(),
    markFulfilled: async (historyId: number) => {
      const h = _history.find((x) => x.id === historyId);
      if (h) h.fulfilled = 1;
      return true;
    },
    getReport: async ({ childId, days = 30 }: { childId: number; days?: number }) => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const rows = _history.filter((h) => h.child_id === childId && new Date(h.created_at) >= cutoff);
      const dailyMap: Record<string, { earned: number; deducted: number }> = {};
      const freqMap: Record<string, { count: number; total_delta: number }> = {};
      let totalEarned = 0, totalDeducted = 0, totalRewardsClaimed = 0;
      const rewardMap: Record<string, number> = {};
      for (const h of rows) {
        const day = h.created_at.slice(0, 10);
        if (!dailyMap[day]) dailyMap[day] = { earned: 0, deducted: 0 };
        if (h.delta > 0) { dailyMap[day].earned += h.delta; totalEarned += h.delta; }
        else { dailyMap[day].deducted += Math.abs(h.delta); totalDeducted += Math.abs(h.delta); }
        if (h.kind === 'reward') { totalRewardsClaimed++; rewardMap[h.reason] = (rewardMap[h.reason] ?? 0) + 1; }
        if (!freqMap[h.reason]) freqMap[h.reason] = { count: 0, total_delta: 0 };
        freqMap[h.reason].count++; freqMap[h.reason].total_delta += h.delta;
      }
      const daily = Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b)).map(([day, v]) => ({ day, ...v }));
      const frequent = Object.entries(freqMap).map(([reason, v]) => ({ reason, ...v })).sort((a, b) => b.count - a.count).slice(0, 8);
      const topClaimedRewards = Object.entries(rewardMap).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count).slice(0, 5);
      return { daily, frequent, balance: balance(childId), totalEarned, totalDeducted, totalRewardsClaimed, topClaimedRewards } as ReportSummary;
    },
    getBehaviourTrend: async ({ childId, reason, days = 14 }: { childId: number; reason: string; days?: number }) => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const rows = _history.filter((h) => h.child_id === childId && h.reason === reason && new Date(h.created_at) >= cutoff);
      const dailyMap: Record<string, { count: number; delta: number }> = {};
      for (const h of rows) {
        const day = h.created_at.slice(0, 10);
        if (!dailyMap[day]) dailyMap[day] = { count: 0, delta: 0 };
        dailyMap[day].count++; dailyMap[day].delta += h.delta;
      }
      const daily = Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b)).map(([day, v]) => ({ day, ...v }));
      const totalCount = rows.length;
      const totalDelta = rows.reduce((s, h) => s + h.delta, 0);
      let peakDay: string | null = null, peakCount = 0;
      for (const [day, v] of Object.entries(dailyMap)) {
        if (v.count > peakCount) { peakCount = v.count; peakDay = day; }
      }
      return { daily, totalCount, totalDelta, peakDay, peakCount } as BehaviourTrend;
    },
    exportHistoryForChild: async (childId: number) =>
      _history.filter((h) => h.child_id === childId).slice().reverse().map((h) => {
        const child = _children.find((c) => c.id === h.child_id)!;
        return { ...h, child_name: child?.name ?? '', child_avatar: child?.avatar_emoji ?? '' } as HistoryExportRow;
      }),
    exportAllHistory: async () =>
      [..._history].reverse().map((h) => {
        const child = _children.find((c) => c.id === h.child_id)!;
        return { ...h, child_name: child?.name ?? '', child_avatar: child?.avatar_emoji ?? '' } as HistoryExportRow;
      }),

    getSiblingComparison: async (): Promise<SiblingSnapshot[]> => {
      return _children.filter((c) => !c.archived).map((c) => {
        const bal = balance(c.id);
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 6);
        const earnedThisWeek = _history.filter((h) => h.child_id === c.id && h.delta > 0 && new Date(h.created_at) >= cutoff).reduce((s, h) => s + h.delta, 0);
        const days = new Set(_history.filter((h) => h.child_id === c.id && h.delta > 0).map((h) => h.created_at.slice(0, 10)));
        let streak = 0;
        const d = new Date();
        while (true) {
          const key = d.toISOString().slice(0, 10);
          if (!days.has(key)) break;
          streak++;
          d.setDate(d.getDate() - 1);
        }
        return { child_id: c.id, child_name: c.name, child_avatar: c.avatar_emoji, theme_color: c.theme_color, balance: bal, earned_this_week: earnedThisWeek, streak };
      });
    },

    getBalanceOverTime: async ({ childId, days = 30 }: { childId: number; days?: number }) => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - (days - 1));
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      const priorBalance = _history.filter((h) => h.child_id === childId && h.created_at.slice(0, 10) < cutoffStr).reduce((s, h) => s + h.delta, 0);
      const windowRows = _history.filter((h) => h.child_id === childId && h.created_at.slice(0, 10) >= cutoffStr);
      const dailyMap: Record<string, number> = {};
      for (const h of windowRows) {
        const day = h.created_at.slice(0, 10);
        dailyMap[day] = (dailyMap[day] ?? 0) + h.delta;
      }
      let running = priorBalance;
      return Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b)).map(([day, net]) => {
        running += net;
        return { day, balance: running };
      });
    },

    // ── History: undo + notes ─────────────────────────────────────────────────
    undoHistory: async (historyId: number) => {
      _history = _history.filter((h) => h.id !== historyId);
      return { balance: 0 };
    },
    updateHistoryNote: async ({ historyId, note }: { historyId: number; note: string }) => {
      const h = _history.find((x) => x.id === historyId);
      if (h) h.note = note;
      return true;
    },

    // ── Per-child behaviour excludes ──────────────────────────────────────────
    listBehaviourExcludes: async (childId: number) =>
      _excludes.filter((e) => e.child_id === childId).map((e) => e.behaviour_id),
    toggleBehaviourExclude: async ({ childId, behaviourId }: { childId: number; behaviourId: number }) => {
      const idx = _excludes.findIndex((e) => e.child_id === childId && e.behaviour_id === behaviourId);
      if (idx >= 0) _excludes.splice(idx, 1);
      else _excludes.push({ child_id: childId, behaviour_id: behaviourId });
      return _excludes.filter((e) => e.child_id === childId).map((e) => e.behaviour_id);
    },

    // ── Backup / restore (no-op in browser) ──────────────────────────────────
    backupExport: async () => ({ ok: false, message: 'Backup not available in browser preview' }),
    backupRestore: async () => ({ ok: false, message: 'Restore not available in browser preview' }),
  };

  (window as unknown as { dojo: typeof mock }).dojo = mock;
}

// ── Run seed ──────────────────────────────────────────────────────────────────
seed();
