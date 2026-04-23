/**
 * webApi.ts
 * Browser-mode implementation of DojoApi, backed entirely by Supabase.
 * Installed into window.dojo once a Supabase session is confirmed.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import type {
  DojoApi, Child, Behaviour, Reward, Consequence, AssignedConsequence,
  HistoryEntry, HistoryExportRow, ParentSettings, PendingBehaviour,
  BehaviourTrend, ReportSummary, SiblingSnapshot,
} from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _env = (import.meta as any).env ?? {};
const SUPABASE_URL      = (_env.VITE_SUPABASE_URL      as string) ?? '';
const SUPABASE_ANON_KEY = (_env.VITE_SUPABASE_ANON_KEY as string) ?? '';

let _sb: SupabaseClient | null = null;
let _userId = '';

function sb(): SupabaseClient {
  if (!_sb) _sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _sb;
}

export function getClient(): SupabaseClient { return sb(); }
function uid(): string  { return _userId; }
function ts(): string   { return new Date().toISOString(); }
function nextId(): number { return Date.now() * 1000 + Math.floor(Math.random() * 999); }

/** Call this once a Supabase session is established. Installs webApi into window.dojo. */
export function initWebApi(userId: string): void {
  _userId = userId;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).dojo = webApi;
  // Seed default data for brand-new accounts (fire-and-forget)
  seedDefaults(userId).catch(console.error);
}

/** Seeds behaviours, consequences and rewards for a new user if their tables are empty. */
async function seedDefaults(userId: string): Promise<void> {
  const client = sb();
  const now = new Date().toISOString();
  const id = () => Date.now() * 1000 + Math.floor(Math.random() * 999);

  // Only seed if the user has no behaviours yet (brand-new account)
  const { count } = await client
    .from('dd_behaviours')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);
  if ((count ?? 0) > 0) return;

  // ── Default behaviours ──────────────────────────────────────────────────────
  await client.from('dd_behaviours').insert([
    { user_id: userId, local_id: id(), name: 'Made the bed',        kind: 'positive', points:  5, icon: '🛏️', active: true, daily_limit: 0, category: '', updated_at: now },
    { user_id: userId, local_id: id(), name: 'Tidied room',         kind: 'positive', points: 10, icon: '🧹', active: true, daily_limit: 0, category: '', updated_at: now },
    { user_id: userId, local_id: id(), name: 'Helped with dishes',  kind: 'positive', points: 10, icon: '🍽️', active: true, daily_limit: 0, category: '', updated_at: now },
    { user_id: userId, local_id: id(), name: 'Finished homework',   kind: 'positive', points: 15, icon: '📚', active: true, daily_limit: 0, category: '', updated_at: now },
    { user_id: userId, local_id: id(), name: 'Was kind to sibling', kind: 'positive', points: 10, icon: '💛', active: true, daily_limit: 0, category: '', updated_at: now },
    { user_id: userId, local_id: id(), name: 'Not listening',       kind: 'negative', points: -5, icon: '🙉', active: true, daily_limit: 0, category: '', updated_at: now },
    { user_id: userId, local_id: id(), name: 'Left mess behind',    kind: 'negative', points: -5, icon: '🧻', active: true, daily_limit: 0, category: '', updated_at: now },
    { user_id: userId, local_id: id(), name: 'Shouted / rude',      kind: 'negative', points:-10, icon: '😠', active: true, daily_limit: 0, category: '', updated_at: now },
  ]);

  // ── Default consequences ────────────────────────────────────────────────────
  await client.from('dd_consequences').insert([
    { user_id: userId, local_id: id(), icon: '📵', name: 'No screen time',  description: 'All devices off until further notice.',              active: true, updated_at: now },
    { user_id: userId, local_id: id(), icon: '🎮', name: 'No video games',  description: 'Gaming privileges suspended for the day.',           active: true, updated_at: now },
    { user_id: userId, local_id: id(), icon: '🛏️', name: 'Early bedtime',   description: 'Bedtime moved 30 minutes earlier tonight.',          active: true, updated_at: now },
    { user_id: userId, local_id: id(), icon: '🍪', name: 'No treats',       description: 'No sweets, snacks, or dessert today.',               active: true, updated_at: now },
    { user_id: userId, local_id: id(), icon: '🏠', name: 'No playdates',    description: 'Social outings are on hold for now.',                active: true, updated_at: now },
    { user_id: userId, local_id: id(), icon: '📺', name: 'No TV',           description: 'Television is off limits for today.',                active: true, updated_at: now },
    { user_id: userId, local_id: id(), icon: '🚲', name: 'No outdoor play', description: 'Outdoor activities suspended until things improve.', active: true, updated_at: now },
    { user_id: userId, local_id: id(), icon: '📚', name: 'Extra reading',   description: '20 minutes of reading added to the daily routine.',  active: true, updated_at: now },
  ]);

  // ── Default rewards ─────────────────────────────────────────────────────────
  await client.from('dd_rewards').insert([
    { user_id: userId, local_id: id(), name: '30 min extra screen time', cost:  30, icon: '📱', active: true, updated_at: now },
    { user_id: userId, local_id: id(), name: 'Pick family movie',        cost:  50, icon: '🎬', active: true, updated_at: now },
    { user_id: userId, local_id: id(), name: 'Ice cream trip',           cost:  80, icon: '🍦', active: true, updated_at: now },
    { user_id: userId, local_id: id(), name: 'New small toy',            cost: 150, icon: '🧸', active: true, updated_at: now },
  ]);
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapChild(r: Record<string, unknown>): Child {
  return {
    id:                   Number(r.local_id),
    name:                 String(r.name ?? ''),
    avatar_emoji:         String(r.avatar_emoji ?? '🥋'),
    goal_points:          Number(r.goal_points ?? 100),
    consequence_threshold:Number(r.consequence_threshold ?? 0),
    archived:             r.archived ? 1 : 0,
    notes:                String(r.notes ?? ''),
    theme_color:          String(r.theme_color ?? '#6366f1'),
    created_at:           String(r.updated_at ?? ts()),
  };
}

function mapBehaviour(r: Record<string, unknown>): Behaviour {
  return {
    id:          Number(r.local_id),
    name:        String(r.name ?? ''),
    kind:        (r.kind as 'positive' | 'negative') ?? 'positive',
    points:      Number(r.points ?? 1),
    icon:        String(r.icon ?? '⭐'),
    active:      r.active ? 1 : 0,
    daily_limit: Number(r.daily_limit ?? 0),
    category:    String(r.category ?? ''),
  };
}

function mapReward(r: Record<string, unknown>): Reward {
  return {
    id:     Number(r.local_id),
    name:   String(r.name ?? ''),
    cost:   Number(r.cost ?? 10),
    icon:   String(r.icon ?? '🎁'),
    active: r.active ? 1 : 0,
  };
}

function mapConsequence(r: Record<string, unknown>): Consequence {
  return {
    id:          Number(r.local_id),
    name:        String(r.name ?? ''),
    icon:        String(r.icon ?? '⚠️'),
    description: String(r.description ?? ''),
    active:      r.active ? 1 : 0,
    created_at:  String(r.updated_at ?? ts()),
  };
}

function mapHistory(r: Record<string, unknown>): HistoryEntry {
  return {
    id:           Number(r.local_id),
    child_id:     Number(r.child_local_id),
    delta:        Number(r.delta ?? 0),
    reason:       String(r.reason ?? ''),
    kind:         (r.kind as HistoryEntry['kind']) ?? 'manual',
    behaviour_id: null,
    reward_id:    null,
    fulfilled:    r.fulfilled ? 1 : 0,
    note:         String(r.note ?? ''),
    created_at:   String(r.created_at ?? ts()),
  };
}

function mapAssigned(
  r: Record<string, unknown>,
  cons: Record<string, unknown>[],
  childs: Record<string, unknown>[],
): AssignedConsequence {
  const c  = cons.find(x => x.local_id === r.consequence_local_id);
  const ch = childs.find(x => x.local_id === r.child_local_id);
  return {
    id:                      Number(r.local_id),
    child_id:                Number(r.child_local_id),
    consequence_id:          Number(r.consequence_local_id),
    duration_days:           Number(r.duration_days ?? 1),
    assigned_at:             String(r.assigned_at ?? ts()),
    expires_at:              r.expires_at ? String(r.expires_at) : null,
    resolved:                r.resolved ? 1 : 0,
    resolved_at:             r.resolved_at ? String(r.resolved_at) : null,
    note:                    String(r.note ?? ''),
    consequence_name:        String(c?.name ?? ''),
    consequence_icon:        String(c?.icon ?? '⚠️'),
    consequence_description: String(c?.description ?? ''),
    child_name:              String(ch?.name ?? ''),
    child_avatar:            String(ch?.avatar_emoji ?? '🥋'),
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function getBalance(childId: number): Promise<number> {
  const { data } = await sb()
    .from('dd_history')
    .select('delta')
    .eq('user_id', uid())
    .eq('child_local_id', childId);
  return (data ?? []).reduce((s, r) => s + Number(r.delta), 0);
}

async function fetchSettings(): Promise<ParentSettings> {
  const { data } = await sb()
    .from('dd_settings')
    .select('*')
    .eq('user_id', uid())
    .maybeSingle();
  return {
    default_goal_points:  Number(data?.default_goal_points  ?? 100),
    default_threshold:    Number(data?.default_threshold    ?? 0),
    default_start_points: Number(data?.default_start_points ?? 0),
    require_approval:     data?.require_approval ? 1 : 0,
    max_points_per_day:   Number(data?.max_points_per_day   ?? 0),
  };
}

// ── The API ───────────────────────────────────────────────────────────────────

export const webApi: DojoApi = {

  // ── Auth ────────────────────────────────────────────────────────────────────
  // webApi is only installed after sign-in, so isSetup always returns true.
  isSetup:     async () => true,
  setupParent: async () => true,

  // Re-authenticate with Supabase to verify the parent portal password.
  // The "parent password" on web is the same as the Supabase account password.
  verifyParent: async (password) => {
    const { data: { session } } = await sb().auth.getSession();
    const email = session?.user?.email;
    if (!email) return false;
    const { error } = await sb().auth.signInWithPassword({ email, password });
    return !error;
  },
  changeParentPassword: async ({ oldPassword, newPassword }) => {
    // Verify old password first
    const { data: { session } } = await sb().auth.getSession();
    const email = session?.user?.email;
    if (!email) return false;
    const { error: verifyErr } = await sb().auth.signInWithPassword({ email, password: oldPassword });
    if (verifyErr) return false;
    const { error } = await sb().auth.updateUser({ password: newPassword });
    return !error;
  },
  hasRecovery:          async () => false,
  getRecoveryQuestion:  async () => null,
  setRecovery:          async () => { /* no-op */ },
  verifyRecoveryAndReset: async () => false,

  // ── Kid PIN ─────────────────────────────────────────────────────────────────
  hasKidPin: async () => {
    const { data } = await sb()
      .from('dd_kid_pin')
      .select('pin_hash')
      .eq('user_id', uid())
      .maybeSingle();
    return !!data?.pin_hash;
  },
  setKidPin: async (pin) => {
    const hash = await bcrypt.hash(pin, 8);
    const { error } = await sb()
      .from('dd_kid_pin')
      .upsert({ user_id: uid(), pin_hash: hash, updated_at: ts() }, { onConflict: 'user_id' });
    return !error;
  },
  verifyKidPin: async (pin) => {
    const { data } = await sb()
      .from('dd_kid_pin')
      .select('pin_hash')
      .eq('user_id', uid())
      .maybeSingle();
    if (!data?.pin_hash) return false;
    return bcrypt.compare(pin, String(data.pin_hash));
  },
  clearKidPin: async () => {
    const { error } = await sb().from('dd_kid_pin').delete().eq('user_id', uid());
    return !error;
  },

  // ── Settings ────────────────────────────────────────────────────────────────
  getSettings: fetchSettings,
  saveSettings: async (payload) => {
    const { error } = await sb().from('dd_settings').upsert({
      user_id:              uid(),
      require_approval:     payload.require_approval === 1,
      default_goal_points:  payload.default_goal_points,
      default_threshold:    payload.default_threshold,
      default_start_points: payload.default_start_points,
      max_points_per_day:   payload.max_points_per_day,
      updated_at:           ts(),
    }, { onConflict: 'user_id' });
    return !error;
  },

  // ── Children ────────────────────────────────────────────────────────────────
  listChildren: async () => {
    const { data } = await sb()
      .from('dd_children')
      .select('*')
      .eq('user_id', uid())
      .eq('archived', false)
      .order('updated_at');
    return (data ?? []).map(r => mapChild(r as Record<string, unknown>));
  },
  listAllChildren: async () => {
    const { data } = await sb()
      .from('dd_children')
      .select('*')
      .eq('user_id', uid())
      .order('updated_at');
    return (data ?? []).map(r => mapChild(r as Record<string, unknown>));
  },
  addChild: async ({ name, avatarEmoji = '🥋', goalPoints = 100, consequenceThreshold = 0, initialPoints = 0, themeColor = '#6366f1' }) => {
    const id = nextId();
    const { data, error } = await sb()
      .from('dd_children')
      .insert({
        user_id: uid(), local_id: id,
        name, avatar_emoji: avatarEmoji, goal_points: goalPoints,
        consequence_threshold: consequenceThreshold,
        theme_color: themeColor, archived: false, notes: '',
        updated_at: ts(),
      })
      .select()
      .single();
    if (error || !data) throw new Error(error?.message ?? 'addChild failed');
    if ((initialPoints ?? 0) > 0) {
      await webApi.manualAdjust({ childId: id, delta: initialPoints!, reason: 'Starting balance' });
    }
    return mapChild(data as Record<string, unknown>);
  },
  updateChild: async ({ id, name, avatarEmoji, goalPoints, consequenceThreshold, notes, themeColor }) => {
    const patch: Record<string, unknown> = { updated_at: ts() };
    if (name                 !== undefined) patch.name                  = name;
    if (avatarEmoji          !== undefined) patch.avatar_emoji          = avatarEmoji;
    if (goalPoints           !== undefined) patch.goal_points           = goalPoints;
    if (consequenceThreshold !== undefined) patch.consequence_threshold = consequenceThreshold;
    if (notes                !== undefined) patch.notes                 = notes;
    if (themeColor           !== undefined) patch.theme_color           = themeColor;
    const { data, error } = await sb()
      .from('dd_children')
      .update(patch)
      .eq('user_id', uid())
      .eq('local_id', id)
      .select()
      .single();
    if (error || !data) throw new Error(error?.message ?? 'updateChild failed');
    return mapChild(data as Record<string, unknown>);
  },
  archiveChild: async (id) => {
    const { error } = await sb()
      .from('dd_children')
      .update({ archived: true, updated_at: ts() })
      .eq('user_id', uid())
      .eq('local_id', id);
    return !error;
  },
  unarchiveChild: async (id) => {
    const { error } = await sb()
      .from('dd_children')
      .update({ archived: false, updated_at: ts() })
      .eq('user_id', uid())
      .eq('local_id', id);
    return !error;
  },
  deleteChild: async (id) => {
    await sb().from('dd_history').delete().eq('user_id', uid()).eq('child_local_id', id);
    await sb().from('dd_pending').delete().eq('user_id', uid()).eq('child_local_id', id);
    await sb().from('dd_assigned_consequences').delete().eq('user_id', uid()).eq('child_local_id', id);
    const { error } = await sb()
      .from('dd_children')
      .delete()
      .eq('user_id', uid())
      .eq('local_id', id);
    return !error;
  },

  // ── Behaviours ──────────────────────────────────────────────────────────────
  listBehaviours: async () => {
    const { data } = await sb()
      .from('dd_behaviours')
      .select('*')
      .eq('user_id', uid())
      .eq('active', true)
      .order('name');
    return (data ?? []).map(r => mapBehaviour(r as Record<string, unknown>));
  },
  listAllBehaviours: async () => {
    const { data } = await sb()
      .from('dd_behaviours')
      .select('*')
      .eq('user_id', uid())
      .order('name');
    return (data ?? []).map(r => mapBehaviour(r as Record<string, unknown>));
  },
  setBehaviourActive: async ({ id, active }) => {
    const { error } = await sb()
      .from('dd_behaviours')
      .update({ active: active === 1, updated_at: ts() })
      .eq('user_id', uid())
      .eq('local_id', id);
    return !error;
  },
  addBehaviour: async ({ name, kind, points, icon = '⭐', dailyLimit = 0, category = '' }) => {
    const id = nextId();
    const { data, error } = await sb()
      .from('dd_behaviours')
      .insert({
        user_id: uid(), local_id: id,
        name, kind, points, icon, active: true,
        daily_limit: dailyLimit, category, updated_at: ts(),
      })
      .select()
      .single();
    if (error || !data) throw new Error(error?.message ?? 'addBehaviour failed');
    return mapBehaviour(data as Record<string, unknown>);
  },
  updateBehaviour: async ({ id, name, kind, points, icon, daily_limit, category }) => {
    const patch: Record<string, unknown> = { updated_at: ts() };
    if (name        !== undefined) patch.name        = name;
    if (kind        !== undefined) patch.kind        = kind;
    if (points      !== undefined) patch.points      = points;
    if (icon        !== undefined) patch.icon        = icon;
    if (daily_limit !== undefined) patch.daily_limit = daily_limit;
    if (category    !== undefined) patch.category    = category;
    const { data, error } = await sb()
      .from('dd_behaviours')
      .update(patch)
      .eq('user_id', uid())
      .eq('local_id', id)
      .select()
      .single();
    if (error || !data) throw new Error(error?.message ?? 'updateBehaviour failed');
    return mapBehaviour(data as Record<string, unknown>);
  },
  deleteBehaviour: async (id) => {
    const { error } = await sb()
      .from('dd_behaviours')
      .delete()
      .eq('user_id', uid())
      .eq('local_id', id);
    return !error;
  },

  // ── Rewards ─────────────────────────────────────────────────────────────────
  listRewards: async () => {
    const { data } = await sb()
      .from('dd_rewards')
      .select('*')
      .eq('user_id', uid())
      .eq('active', true)
      .order('name');
    return (data ?? []).map(r => mapReward(r as Record<string, unknown>));
  },
  addReward: async ({ name, cost, icon = '🎁' }) => {
    const id = nextId();
    const { data, error } = await sb()
      .from('dd_rewards')
      .insert({ user_id: uid(), local_id: id, name, cost, icon, active: true, updated_at: ts() })
      .select()
      .single();
    if (error || !data) throw new Error(error?.message ?? 'addReward failed');
    return mapReward(data as Record<string, unknown>);
  },
  updateReward: async ({ id, name, cost, icon }) => {
    const patch: Record<string, unknown> = { updated_at: ts() };
    if (name !== undefined) patch.name = name;
    if (cost !== undefined) patch.cost = cost;
    if (icon !== undefined) patch.icon = icon;
    const { data, error } = await sb()
      .from('dd_rewards')
      .update(patch)
      .eq('user_id', uid())
      .eq('local_id', id)
      .select()
      .single();
    if (error || !data) throw new Error(error?.message ?? 'updateReward failed');
    return mapReward(data as Record<string, unknown>);
  },
  deleteReward: async (id) => {
    const { error } = await sb()
      .from('dd_rewards')
      .delete()
      .eq('user_id', uid())
      .eq('local_id', id);
    return !error;
  },
  redeemReward: async ({ childId, rewardId }) => {
    const [{ data: rw }, balance] = await Promise.all([
      sb().from('dd_rewards').select('*').eq('user_id', uid()).eq('local_id', rewardId).maybeSingle(),
      getBalance(childId),
    ]);
    if (!rw) return { ok: false, message: 'Reward not found' };
    const cost = Number(rw.cost);
    if (balance < cost) return { ok: false, message: 'Not enough points' };
    await sb().from('dd_history').insert({
      user_id: uid(), local_id: nextId(), child_local_id: childId,
      delta: -cost, reason: String(rw.name), kind: 'reward',
      fulfilled: false, note: '', created_at: ts(),
    });
    return { ok: true, balance: balance - cost };
  },

  // ── Consequences (library) ───────────────────────────────────────────────────
  listConsequences: async () => {
    const { data } = await sb()
      .from('dd_consequences')
      .select('*')
      .eq('user_id', uid())
      .order('name');
    return (data ?? []).map(r => mapConsequence(r as Record<string, unknown>));
  },
  addConsequence: async ({ name, icon, description }) => {
    const id = nextId();
    const { data, error } = await sb()
      .from('dd_consequences')
      .insert({ user_id: uid(), local_id: id, name, icon, description, active: true, updated_at: ts() })
      .select()
      .single();
    if (error || !data) throw new Error(error?.message ?? 'addConsequence failed');
    return mapConsequence(data as Record<string, unknown>);
  },
  updateConsequence: async ({ id, name, icon, description }) => {
    const patch: Record<string, unknown> = { updated_at: ts() };
    if (name        !== undefined) patch.name        = name;
    if (icon        !== undefined) patch.icon        = icon;
    if (description !== undefined) patch.description = description;
    const { data, error } = await sb()
      .from('dd_consequences')
      .update(patch)
      .eq('user_id', uid())
      .eq('local_id', id)
      .select()
      .single();
    if (error || !data) throw new Error(error?.message ?? 'updateConsequence failed');
    return mapConsequence(data as Record<string, unknown>);
  },
  deleteConsequence: async (id) => {
    const { error } = await sb()
      .from('dd_consequences')
      .delete()
      .eq('user_id', uid())
      .eq('local_id', id);
    return !error;
  },

  // ── Consequence assignments ──────────────────────────────────────────────────
  assignConsequence: async ({ childId, consequenceId, durationDays, note = '' }) => {
    const [{ data: ch }, { data: con }] = await Promise.all([
      sb().from('dd_children').select('name,avatar_emoji').eq('user_id', uid()).eq('local_id', childId).maybeSingle(),
      sb().from('dd_consequences').select('name,icon,description').eq('user_id', uid()).eq('local_id', consequenceId).maybeSingle(),
    ]);
    const id = nextId();
    const assignedAt = ts();
    const expiresAt  = durationDays > 0
      ? new Date(Date.now() + durationDays * 86_400_000).toISOString()
      : null;
    await sb().from('dd_assigned_consequences').insert({
      user_id: uid(), local_id: id,
      child_local_id: childId, consequence_local_id: consequenceId,
      duration_days: durationDays, assigned_at: assignedAt,
      expires_at: expiresAt, resolved: false, resolved_at: null, note,
    });
    return {
      id, child_id: childId, consequence_id: consequenceId,
      duration_days: durationDays, assigned_at: assignedAt,
      expires_at: expiresAt, resolved: 0, resolved_at: null, note,
      consequence_name: String(con?.name ?? ''),
      consequence_icon: String(con?.icon ?? '⚠️'),
      consequence_description: String(con?.description ?? ''),
      child_name:   String(ch?.name ?? ''),
      child_avatar: String(ch?.avatar_emoji ?? '🥋'),
    };
  },
  resolveConsequence: async (id) => {
    const { error } = await sb()
      .from('dd_assigned_consequences')
      .update({ resolved: true, resolved_at: ts() })
      .eq('user_id', uid())
      .eq('local_id', id);
    return !error;
  },
  getActiveConsequencesForChild: async (childId) => {
    const { data: rows } = await sb()
      .from('dd_assigned_consequences')
      .select('*')
      .eq('user_id', uid())
      .eq('child_local_id', childId)
      .eq('resolved', false);
    if (!rows?.length) return [];
    const [{ data: cons }, { data: childs }] = await Promise.all([
      sb().from('dd_consequences').select('*').eq('user_id', uid()),
      sb().from('dd_children').select('*').eq('user_id', uid()),
    ]);
    return rows.map(r => mapAssigned(
      r as Record<string, unknown>,
      (cons ?? []) as Record<string, unknown>[],
      (childs ?? []) as Record<string, unknown>[],
    ));
  },
  getAllActiveConsequences: async () => {
    const { data: rows } = await sb()
      .from('dd_assigned_consequences')
      .select('*')
      .eq('user_id', uid())
      .eq('resolved', false);
    if (!rows?.length) return [];
    const [{ data: cons }, { data: childs }] = await Promise.all([
      sb().from('dd_consequences').select('*').eq('user_id', uid()),
      sb().from('dd_children').select('*').eq('user_id', uid()),
    ]);
    return rows.map(r => mapAssigned(
      r as Record<string, unknown>,
      (cons ?? []) as Record<string, unknown>[],
      (childs ?? []) as Record<string, unknown>[],
    ));
  },

  // ── Pending behaviour approvals ──────────────────────────────────────────────
  listPending: async () => {
    const { data: rows } = await sb()
      .from('dd_pending')
      .select('*')
      .eq('user_id', uid())
      .order('created_at');
    if (!rows?.length) return [];
    const [{ data: behs }, { data: childs }] = await Promise.all([
      sb().from('dd_behaviours').select('*').eq('user_id', uid()),
      sb().from('dd_children').select('*').eq('user_id', uid()),
    ]);
    return rows.map((r): PendingBehaviour => {
      const b  = (behs   ?? []).find(x => x.local_id === r.behaviour_local_id);
      const ch = (childs ?? []).find(x => x.local_id === r.child_local_id);
      return {
        id: Number(r.local_id), child_id: Number(r.child_local_id),
        behaviour_id: Number(r.behaviour_local_id), created_at: String(r.created_at),
        child_name:       String(ch?.name ?? ''),
        child_avatar:     String(ch?.avatar_emoji ?? '🥋'),
        behaviour_name:   String(b?.name ?? ''),
        behaviour_icon:   String(b?.icon ?? '⭐'),
        behaviour_points: Number(b?.points ?? 0),
        behaviour_kind:   (b?.kind as 'positive' | 'negative') ?? 'positive',
      };
    });
  },
  countPending: async () => {
    const { count } = await sb()
      .from('dd_pending')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', uid());
    return count ?? 0;
  },
  addPending: async ({ childId, behaviourId }) => {
    const id = nextId();
    const [{ data: b }, { data: ch }] = await Promise.all([
      sb().from('dd_behaviours').select('*').eq('user_id', uid()).eq('local_id', behaviourId).maybeSingle(),
      sb().from('dd_children').select('*').eq('user_id', uid()).eq('local_id', childId).maybeSingle(),
    ]);
    const created_at = ts();
    await sb().from('dd_pending').insert({
      user_id: uid(), local_id: id,
      child_local_id: childId, behaviour_local_id: behaviourId, created_at,
    });
    return {
      id, child_id: childId, behaviour_id: behaviourId, created_at,
      child_name:       String(ch?.name ?? ''),
      child_avatar:     String(ch?.avatar_emoji ?? '🥋'),
      behaviour_name:   String(b?.name ?? ''),
      behaviour_icon:   String(b?.icon ?? '⭐'),
      behaviour_points: Number(b?.points ?? 0),
      behaviour_kind:   (b?.kind as 'positive' | 'negative') ?? 'positive',
    };
  },
  approvePending: async (id) => {
    const { data: row } = await sb()
      .from('dd_pending')
      .select('*')
      .eq('user_id', uid())
      .eq('local_id', id)
      .maybeSingle();
    if (!row) return { balance: 0, delta: 0, milestone: false, consequenceTriggered: false };
    await sb().from('dd_pending').delete().eq('user_id', uid()).eq('local_id', id);
    const r = await webApi.applyBehaviour({ childId: Number(row.child_local_id), behaviourId: Number(row.behaviour_local_id) });
    return { balance: r.balance, delta: r.delta, milestone: r.milestone, consequenceTriggered: r.consequenceTriggered };
  },
  rejectPending: async (id) => {
    const { error } = await sb().from('dd_pending').delete().eq('user_id', uid()).eq('local_id', id);
    return !error;
  },
  rejectAllPending: async () => {
    const { error } = await sb().from('dd_pending').delete().eq('user_id', uid());
    return !error;
  },
  approveAllPending: async () => {
    const pending = await webApi.listPending();
    const results = [];
    for (const p of pending) {
      const r = await webApi.applyBehaviour({ childId: p.child_id, behaviourId: p.behaviour_id });
      results.push({ balance: r.balance, delta: r.delta, milestone: r.milestone, consequenceTriggered: r.consequenceTriggered });
    }
    await sb().from('dd_pending').delete().eq('user_id', uid());
    return results;
  },

  // ── Points / History ─────────────────────────────────────────────────────────
  applyBehaviour: async ({ childId, behaviourId }) => {
    const [{ data: child }, { data: beh }, settings, balance] = await Promise.all([
      sb().from('dd_children').select('*').eq('user_id', uid()).eq('local_id', childId).maybeSingle(),
      sb().from('dd_behaviours').select('*').eq('user_id', uid()).eq('local_id', behaviourId).maybeSingle(),
      fetchSettings(),
      getBalance(childId),
    ]);
    if (!child || !beh) throw new Error('Child or behaviour not found');

    let delta = Number(beh.points);

    // Daily limit check
    if (Number(beh.daily_limit) > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: todayH } = await sb()
        .from('dd_history')
        .select('local_id')
        .eq('user_id', uid())
        .eq('child_local_id', childId)
        .eq('reason', String(beh.name))
        .gte('created_at', today + 'T00:00:00');
      if ((todayH ?? []).length >= Number(beh.daily_limit)) {
        return { balance, delta: 0, milestone: false, consequenceTriggered: false, historyId: 0, capped: true };
      }
    }

    // Max points per day cap
    if (settings.max_points_per_day > 0 && delta > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: todayH } = await sb()
        .from('dd_history')
        .select('delta')
        .eq('user_id', uid())
        .eq('child_local_id', childId)
        .gte('created_at', today + 'T00:00:00');
      const todayEarned = (todayH ?? []).filter(r => Number(r.delta) > 0).reduce((s, r) => s + Number(r.delta), 0);
      if (todayEarned >= settings.max_points_per_day) {
        return { balance, delta: 0, milestone: false, consequenceTriggered: false, historyId: 0, capped: true };
      }
      const remaining = settings.max_points_per_day - todayEarned;
      if (delta > remaining) delta = remaining;
    }

    const id = nextId();
    await sb().from('dd_history').insert({
      user_id: uid(), local_id: id, child_local_id: childId,
      delta, reason: String(beh.name), kind: String(beh.kind),
      fulfilled: true, note: '', created_at: ts(),
    });

    const newBalance  = balance + delta;
    const goalPoints  = Number(child.goal_points);
    const threshold   = Number(child.consequence_threshold);
    const milestone   = delta > 0 && newBalance >= goalPoints && balance < goalPoints;
    const consequenceTriggered = threshold > 0 && newBalance <= threshold && balance > threshold;

    return { balance: newBalance, delta, milestone, consequenceTriggered, historyId: id };
  },

  manualAdjust: async ({ childId, delta, reason }) => {
    await sb().from('dd_history').insert({
      user_id: uid(), local_id: nextId(), child_local_id: childId,
      delta, reason, kind: 'manual', fulfilled: true, note: '', created_at: ts(),
    });
    return { balance: await getBalance(childId) };
  },

  getChildPoints: async (childId) => getBalance(childId),

  getStreak: async (childId) => {
    const { data } = await sb()
      .from('dd_history')
      .select('delta,created_at')
      .eq('user_id', uid())
      .eq('child_local_id', childId)
      .order('created_at', { ascending: false })
      .limit(365);
    const days = new Set<string>();
    for (const r of data ?? []) {
      if (Number(r.delta) > 0) days.add(String(r.created_at).slice(0, 10));
    }
    let streak = 0;
    const base = new Date();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const d = new Date(base);
      d.setDate(base.getDate() - streak);
      if (!days.has(d.toISOString().slice(0, 10))) break;
      streak++;
    }
    return streak;
  },

  getHistory: async ({ childId, fromIso, toIso }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = sb().from('dd_history').select('*').eq('user_id', uid()).order('created_at', { ascending: false });
    if (childId) q = q.eq('child_local_id', childId);
    if (fromIso) q = q.gte('created_at', fromIso);
    if (toIso)   q = q.lte('created_at', toIso);
    const { data } = await q.limit(500);
    return (data ?? []).map((r: Record<string, unknown>) => mapHistory(r));
  },

  getClaimedRewards: async (childId) => {
    const { data } = await sb()
      .from('dd_history')
      .select('*')
      .eq('user_id', uid())
      .eq('child_local_id', childId)
      .eq('kind', 'reward')
      .order('created_at', { ascending: false });
    return (data ?? []).map(r => mapHistory(r as Record<string, unknown>));
  },

  markFulfilled: async (historyId) => {
    const { error } = await sb()
      .from('dd_history')
      .update({ fulfilled: true })
      .eq('user_id', uid())
      .eq('local_id', historyId);
    return !error;
  },

  undoHistory: async (historyId) => {
    const { data: row } = await sb()
      .from('dd_history')
      .select('child_local_id')
      .eq('user_id', uid())
      .eq('local_id', historyId)
      .maybeSingle();
    if (!row) return { ok: false, message: 'Record not found' };
    await sb().from('dd_history').delete().eq('user_id', uid()).eq('local_id', historyId);
    return { ok: true, balance: await getBalance(Number(row.child_local_id)) };
  },

  updateHistoryNote: async ({ historyId, note }) => {
    const { error } = await sb()
      .from('dd_history')
      .update({ note })
      .eq('user_id', uid())
      .eq('local_id', historyId);
    return !error;
  },

  // ── Reports ──────────────────────────────────────────────────────────────────
  getReport: async ({ childId, days = 30 }) => {
    const from = new Date(Date.now() - days * 86_400_000).toISOString();
    const { data } = await sb()
      .from('dd_history')
      .select('*')
      .eq('user_id', uid())
      .eq('child_local_id', childId)
      .gte('created_at', from)
      .order('created_at');
    const rows = data ?? [];

    const dailyMap:  Record<string, { earned: number; deducted: number }> = {};
    const reasonMap: Record<string, { count: number; total_delta: number }> = {};
    const rewardMap: Record<string, number> = {};
    let totalEarned = 0, totalDeducted = 0, totalRewards = 0;

    for (const r of rows) {
      const day = String(r.created_at).slice(0, 10);
      if (!dailyMap[day]) dailyMap[day] = { earned: 0, deducted: 0 };
      const d = Number(r.delta);
      if (d > 0) { dailyMap[day].earned   += d;          totalEarned   += d; }
      else       { dailyMap[day].deducted += Math.abs(d); totalDeducted += Math.abs(d); }
      if (r.kind === 'reward') {
        rewardMap[String(r.reason)] = (rewardMap[String(r.reason)] ?? 0) + 1;
        totalRewards++;
      }
      const key = String(r.reason);
      if (!reasonMap[key]) reasonMap[key] = { count: 0, total_delta: 0 };
      reasonMap[key].count++;
      reasonMap[key].total_delta += d;
    }

    const balance = await getBalance(childId);
    const report: ReportSummary = {
      balance, totalEarned, totalDeducted, totalRewardsClaimed: totalRewards,
      daily: Object.entries(dailyMap)
        .map(([day, v]) => ({ day, ...v }))
        .sort((a, b) => a.day.localeCompare(b.day)),
      frequent: Object.entries(reasonMap)
        .map(([reason, v]) => ({ reason, ...v }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      topClaimedRewards: Object.entries(rewardMap)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    };
    return report;
  },

  getBehaviourTrend: async ({ childId, reason, days = 30 }) => {
    const from = new Date(Date.now() - days * 86_400_000).toISOString();
    const { data } = await sb()
      .from('dd_history')
      .select('delta,created_at')
      .eq('user_id', uid())
      .eq('child_local_id', childId)
      .eq('reason', reason)
      .gte('created_at', from)
      .order('created_at');
    const rows = data ?? [];
    const dailyMap: Record<string, { count: number; delta: number }> = {};
    for (const r of rows) {
      const day = String(r.created_at).slice(0, 10);
      if (!dailyMap[day]) dailyMap[day] = { count: 0, delta: 0 };
      dailyMap[day].count++;
      dailyMap[day].delta += Number(r.delta);
    }
    const daily = Object.entries(dailyMap)
      .map(([day, v]) => ({ day, ...v }))
      .sort((a, b) => a.day.localeCompare(b.day));
    const peak = daily.reduce<typeof daily[0] | null>((m, d) => (!m || d.count > m.count ? d : m), null);
    const trend: BehaviourTrend = {
      daily, totalCount: rows.length,
      totalDelta: rows.reduce((s, r) => s + Number(r.delta), 0),
      peakDay: peak?.day ?? null, peakCount: peak?.count ?? 0,
    };
    return trend;
  },

  getSiblingComparison: async () => {
    const { data: childs } = await sb()
      .from('dd_children')
      .select('*')
      .eq('user_id', uid())
      .eq('archived', false);
    if (!childs?.length) return [];
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    return Promise.all(childs.map(async (ch): Promise<SiblingSnapshot> => {
      const cid = Number(ch.local_id);
      const [balance, { data: weekH }] = await Promise.all([
        getBalance(cid),
        sb().from('dd_history').select('delta').eq('user_id', uid()).eq('child_local_id', cid).gte('created_at', weekAgo),
      ]);
      const earnedWeek = (weekH ?? []).filter(r => Number(r.delta) > 0).reduce((s, r) => s + Number(r.delta), 0);
      const streak = await webApi.getStreak(cid);
      return {
        child_id:         cid,
        child_name:       String(ch.name),
        child_avatar:     String(ch.avatar_emoji ?? '🥋'),
        theme_color:      String(ch.theme_color ?? '#6366f1'),
        balance, earned_this_week: earnedWeek, streak,
      };
    }));
  },

  getBalanceOverTime: async ({ childId, days = 30 }) => {
    const from = new Date(Date.now() - days * 86_400_000).toISOString();
    const { data } = await sb()
      .from('dd_history')
      .select('delta,created_at')
      .eq('user_id', uid())
      .eq('child_local_id', childId)
      .gte('created_at', from)
      .order('created_at');
    const dailyDelta: Record<string, number> = {};
    for (const r of data ?? []) {
      const day = String(r.created_at).slice(0, 10);
      dailyDelta[day] = (dailyDelta[day] ?? 0) + Number(r.delta);
    }
    let running = 0;
    return Object.entries(dailyDelta)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, d]) => { running += d; return { day, balance: running }; });
  },

  exportHistoryForChild: async (childId) => {
    const [{ data: h }, { data: ch }] = await Promise.all([
      sb().from('dd_history').select('*').eq('user_id', uid()).eq('child_local_id', childId).order('created_at', { ascending: false }),
      sb().from('dd_children').select('name,avatar_emoji').eq('user_id', uid()).eq('local_id', childId).maybeSingle(),
    ]);
    return (h ?? []).map((r): HistoryExportRow => ({
      ...mapHistory(r as Record<string, unknown>),
      child_name:   String(ch?.name ?? ''),
      child_avatar: String(ch?.avatar_emoji ?? '🥋'),
    }));
  },

  exportAllHistory: async () => {
    const [{ data: h }, { data: childs }] = await Promise.all([
      sb().from('dd_history').select('*').eq('user_id', uid()).order('created_at', { ascending: false }),
      sb().from('dd_children').select('*').eq('user_id', uid()),
    ]);
    return (h ?? []).map((r): HistoryExportRow => {
      const ch = (childs ?? []).find(x => x.local_id === r.child_local_id);
      return {
        ...mapHistory(r as Record<string, unknown>),
        child_name:   String(ch?.name ?? ''),
        child_avatar: String(ch?.avatar_emoji ?? '🥋'),
      };
    });
  },

  // ── Per-child behaviour excludes (web MVP: no-op) ───────────────────────────
  listBehaviourExcludes:  async () => [],
  toggleBehaviourExclude: async () => [],

  // ── Backup / restore (desktop only) ─────────────────────────────────────────
  backupExport:  async () => ({ ok: false, message: 'Backup is only available in the desktop app.' }),
  backupRestore: async () => ({ ok: false, message: 'Restore is only available in the desktop app.' }),

  // ── Cloud status (web users are always in the cloud) ─────────────────────────
  cloudStatus: async () => {
    const { data } = await sb().auth.getSession();
    const email = data.session?.user?.email ?? '';
    return {
      configured: true, connected: !!data.session, email,
      lastSync: ts(), resendKey: false, notifEmail: email,
      weeklyDigest: false, approvalAlerts: false,
    };
  },
  cloudSignUp:          async ({ email, password }) => {
    const { error } = await sb().auth.signUp({ email, password });
    return error ? { ok: false, error: error.message } : { ok: true };
  },
  cloudSignIn:          async ({ email, password }) => {
    const { error } = await sb().auth.signInWithPassword({ email, password });
    return error ? { ok: false, error: error.message } : { ok: true };
  },
  cloudSignOut:         async () => { await sb().auth.signOut(); return true; },
  cloudSyncNow:         async () => ({ ok: true, pulled: 0 }),
  cloudSaveEmailConfig: async () => false,
  cloudSendTestEmail:   async () => ({ ok: false }),
  cloudSendWeeklyDigest:async () => ({ ok: false }),
};

/**
 * Permanently deletes the current user's account.
 * Calls the `delete-account` Edge Function which removes all dd_* data
 * and then deletes the Supabase auth user, then signs out locally.
 * Returns { ok: true } on success or { ok: false, error: string } on failure.
 */
export async function deleteWebAccount(password: string): Promise<{ ok: boolean; error?: string }> {
  // Re-verify password before irreversible deletion
  const { data: { session } } = await sb().auth.getSession();
  const email = session?.user?.email;
  if (!email) return { ok: false, error: 'No active session' };

  const { error: verifyErr } = await sb().auth.signInWithPassword({ email, password });
  if (verifyErr) return { ok: false, error: 'Password is incorrect' };

  // Retrieve a fresh token after re-auth
  const { data: { session: freshSession } } = await sb().auth.getSession();
  const token = freshSession?.access_token;
  if (!token) return { ok: false, error: 'Could not refresh session' };

  // Call the Edge Function
  const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { ok: false, error: (body as { error?: string }).error ?? `HTTP ${res.status}` };
  }

  // Sign out locally so the UI resets to the login screen
  await sb().auth.signOut();
  return { ok: true };
}
