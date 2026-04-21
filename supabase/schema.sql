-- ─────────────────────────────────────────────────────────────────────────────
-- DutyDojo – Supabase cloud schema
-- Run this once in the Supabase SQL editor for your project.
-- ─────────────────────────────────────────────────────────────────────────────

-- Children ────────────────────────────────────────────────────────────────────
create table if not exists public.dd_children (
  user_id     uuid    references auth.users(id) on delete cascade not null,
  local_id    bigint  not null,
  name        text    not null,
  avatar_emoji text   default '🥋',
  goal_points int     default 100,
  consequence_threshold int default 0,
  notes       text    default '',
  theme_color text    default '#6366f1',
  archived    boolean default false,
  updated_at  timestamptz default now(),
  primary key (user_id, local_id)
);
alter table public.dd_children enable row level security;
create policy "own children" on public.dd_children for all using (auth.uid() = user_id);

-- Behaviours ──────────────────────────────────────────────────────────────────
create table if not exists public.dd_behaviours (
  user_id     uuid    references auth.users(id) on delete cascade not null,
  local_id    bigint  not null,
  name        text    not null,
  kind        text    not null check (kind in ('positive','negative')),
  points      int     not null,
  icon        text    default '⭐',
  active      boolean default true,
  daily_limit int     default 0,
  category    text    default '',
  updated_at  timestamptz default now(),
  primary key (user_id, local_id)
);
alter table public.dd_behaviours enable row level security;
create policy "own behaviours" on public.dd_behaviours for all using (auth.uid() = user_id);

-- Rewards ─────────────────────────────────────────────────────────────────────
create table if not exists public.dd_rewards (
  user_id     uuid    references auth.users(id) on delete cascade not null,
  local_id    bigint  not null,
  name        text    not null,
  cost        int     not null,
  icon        text    default '🎁',
  active      boolean default true,
  updated_at  timestamptz default now(),
  primary key (user_id, local_id)
);
alter table public.dd_rewards enable row level security;
create policy "own rewards" on public.dd_rewards for all using (auth.uid() = user_id);

-- Consequences ────────────────────────────────────────────────────────────────
create table if not exists public.dd_consequences (
  user_id     uuid    references auth.users(id) on delete cascade not null,
  local_id    bigint  not null,
  name        text    not null,
  icon        text    default '⚠️',
  description text    default '',
  active      boolean default true,
  updated_at  timestamptz default now(),
  primary key (user_id, local_id)
);
alter table public.dd_consequences enable row level security;
create policy "own consequences" on public.dd_consequences for all using (auth.uid() = user_id);

-- Points history ──────────────────────────────────────────────────────────────
create table if not exists public.dd_history (
  user_id        uuid    references auth.users(id) on delete cascade not null,
  local_id       bigint  not null,
  child_local_id bigint  not null,
  delta          int     not null,
  reason         text    not null default '',
  kind           text    not null,
  note           text    default '',
  fulfilled      boolean default false,
  created_at     timestamptz default now(),
  primary key (user_id, local_id)
);
alter table public.dd_history enable row level security;
create policy "own history" on public.dd_history for all using (auth.uid() = user_id);

-- Family settings ─────────────────────────────────────────────────────────────
create table if not exists public.dd_settings (
  user_id              uuid    primary key references auth.users(id) on delete cascade,
  require_approval     boolean default false,
  default_goal_points  int     default 100,
  default_threshold    int     default 0,
  default_start_points int     default 0,
  max_points_per_day   int     default 0,
  notification_email   text    default '',
  weekly_digest        boolean default false,
  approval_alerts      boolean default false,
  updated_at           timestamptz default now()
);
alter table public.dd_settings enable row level security;
create policy "own settings" on public.dd_settings for all using (auth.uid() = user_id);
