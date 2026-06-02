-- Oura / wearable recovery integration
-- Run this in Supabase SQL editor before connecting Oura.

create table if not exists public.wearable_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_user_id text,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  scope text,
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  raw_profile jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, provider)
);

create table if not exists public.daily_recovery_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  date date not null,
  readiness_score numeric,
  sleep_score numeric,
  activity_score numeric,
  hrv numeric,
  resting_hr numeric,
  spo2 numeric,
  skin_temp numeric,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, provider, date)
);

alter table public.wearable_connections enable row level security;
alter table public.daily_recovery_scores enable row level security;

drop policy if exists "Users can read own wearable connections" on public.wearable_connections;
create policy "Users can read own wearable connections"
  on public.wearable_connections
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own wearable connections" on public.wearable_connections;
create policy "Users can insert own wearable connections"
  on public.wearable_connections
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own wearable connections" on public.wearable_connections;
create policy "Users can update own wearable connections"
  on public.wearable_connections
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own wearable connections" on public.wearable_connections;
create policy "Users can delete own wearable connections"
  on public.wearable_connections
  for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can read own recovery scores" on public.daily_recovery_scores;
create policy "Users can read own recovery scores"
  on public.daily_recovery_scores
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own recovery scores" on public.daily_recovery_scores;
create policy "Users can insert own recovery scores"
  on public.daily_recovery_scores
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own recovery scores" on public.daily_recovery_scores;
create policy "Users can update own recovery scores"
  on public.daily_recovery_scores
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own recovery scores" on public.daily_recovery_scores;
create policy "Users can delete own recovery scores"
  on public.daily_recovery_scores
  for delete
  using (auth.uid() = user_id);
