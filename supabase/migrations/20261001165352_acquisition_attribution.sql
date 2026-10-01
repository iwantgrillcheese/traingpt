-- No historical acquisition sources are inferred or backfilled.
create table public.acquisition_config (
  id boolean primary key default true check (id),
  started_at timestamptz not null default now()
);
insert into public.acquisition_config (id) values (true);
create table public.account_acquisition (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_created_at timestamptz not null,
  environment text not null check (environment in ('production','test')),
  first_touch jsonb,
  source text not null default 'unknown/direct',
  signup_emitted_at timestamptz,
  associated_at timestamptz not null default now(),
  check (first_touch is null or (jsonb_typeof(first_touch) = 'object' and first_touch->>'version' = '1'))
);
create table public.acquisition_saved_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid,
  saved_at timestamptz not null default now(),
  sessions_created integer not null check (sessions_created > 0)
);
create index acquisition_saved_plans_user_at on public.acquisition_saved_plans(user_id,saved_at);
create table public.acquisition_schedule_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  used_on date not null,
  primary key (user_id,used_on)
);
create table public.acquisition_exclusions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reason text not null
);
-- Verified founder identity; excludes account activity, not guessed anonymous traffic.
insert into public.acquisition_exclusions (user_id, reason)
select id, 'founder' from auth.users where id in (
  '8ebc564a-6ee6-4542-8032-b4cbe3de2296',
  '8450d4e4-a8e9-44b8-83eb-09a51f23836a'
);

-- Server-only reporting ledgers. The existing authenticated Next routes are the
-- access boundary; no client can forge account creation/source or read other users.
alter table public.acquisition_config enable row level security;
alter table public.account_acquisition enable row level security;
alter table public.acquisition_saved_plans enable row level security;
alter table public.acquisition_schedule_days enable row level security;
alter table public.acquisition_exclusions enable row level security;
revoke all on public.acquisition_config, public.account_acquisition, public.acquisition_saved_plans,
  public.acquisition_schedule_days, public.acquisition_exclusions from public, anon, authenticated;
grant all on public.acquisition_config, public.account_acquisition, public.acquisition_saved_plans,
  public.acquisition_schedule_days, public.acquisition_exclusions to service_role;

alter table public.profiles
  add column first_plan_saved_at timestamptz,
  add column discovery_eligible boolean not null default false,
  add column discovery_source text check (discovery_source in ('search','reddit','strava','social','friend_coach','ai','other')),
  add column discovery_detail text check (length(discovery_detail) <= 200),
  add column discovery_answered_at timestamptz,
  add column discovery_skipped_at timestamptz;
