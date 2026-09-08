-- Audit remediation: preserve plan history, persist Strava freshness, and keep
-- athlete training metrics canonical across Settings and generated plan metadata.

alter table public.profiles
  add column if not exists strava_last_synced_at timestamptz;

create table if not exists public.plan_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  source_plan_id uuid,
  race_type text,
  race_date date,
  plan jsonb not null,
  sessions jsonb not null default '[]'::jsonb,
  completed_sessions jsonb not null default '[]'::jsonb,
  archived_at timestamptz not null default now()
);

create index if not exists plan_history_user_archived_idx
  on public.plan_history (user_id, archived_at desc);

alter table public.plan_history enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'plan_history'
      and policyname = 'Users can read their own plan history'
  ) then
    create policy "Users can read their own plan history"
      on public.plan_history
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

create or replace function public.archive_plan_before_replace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_generated_at text;
  new_generated_at text;
begin
  old_generated_at := old.plan #>> '{metadata,generatedAt}';
  new_generated_at := new.plan #>> '{metadata,generatedAt}';

  -- Archive only a real regeneration/replacement. Zone-setting synchronization
  -- updates plan.params but intentionally keeps generatedAt unchanged.
  if old_generated_at is distinct from new_generated_at
     or old.race_type is distinct from new.race_type
     or old.race_date is distinct from new.race_date then
    insert into public.plan_history (
      user_id,
      source_plan_id,
      race_type,
      race_date,
      plan,
      sessions,
      completed_sessions,
      archived_at
    )
    values (
      old.user_id,
      old.id,
      old.race_type,
      old.race_date,
      old.plan,
      coalesce(
        (select jsonb_agg(to_jsonb(s) order by s.date)
         from public.sessions s
         where s.user_id = old.user_id and s.plan_id = old.id),
        '[]'::jsonb
      ),
      coalesce(
        (select jsonb_agg(to_jsonb(c) order by coalesce(c.date, c.session_date))
         from public.completed_sessions c
         where c.user_id = old.user_id),
        '[]'::jsonb
      ),
      now()
    );
  end if;

  return new;
end;
$$;

drop trigger if exists archive_plan_before_replace_trigger on public.plans;
create trigger archive_plan_before_replace_trigger
before update on public.plans
for each row execute function public.archive_plan_before_replace();

create or replace function public.seconds_to_pace_text(total_seconds integer, suffix text)
returns text
language sql
immutable
as $$
  select case
    when total_seconds is null or total_seconds <= 0 then null
    else floor(total_seconds / 60)::int::text || ':' || lpad((total_seconds % 60)::text, 2, '0') || suffix
  end;
$$;

create or replace function public.sync_profile_zones_to_active_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  run_suffix text;
begin
  if new.bike_ftp is not distinct from old.bike_ftp
     and new.run_threshold_per_mile is not distinct from old.run_threshold_per_mile
     and new.run_pace_unit is not distinct from old.run_pace_unit
     and new.swim_threshold_per_100m is not distinct from old.swim_threshold_per_100m then
    return new;
  end if;

  run_suffix := case when new.run_pace_unit = 'km' then ' / km' else ' / mi' end;

  update public.plans
  set plan = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            coalesce(plan, '{}'::jsonb),
            '{params,bikeFTP}', to_jsonb(new.bike_ftp), true
          ),
          '{params,bikeFtp}', to_jsonb(new.bike_ftp), true
        ),
        '{params,runPace}',
        coalesce(to_jsonb(public.seconds_to_pace_text(new.run_threshold_per_mile, run_suffix)), 'null'::jsonb),
        true
      ),
      '{params,paceUnit}', to_jsonb(case when new.run_pace_unit = 'km' then 'km' else 'mi' end), true
    ),
    '{params,swimPace}',
    coalesce(to_jsonb(public.seconds_to_pace_text(new.swim_threshold_per_100m, ' / 100m')), 'null'::jsonb),
    true
  )
  where user_id = new.id;

  return new;
end;
$$;

drop trigger if exists sync_profile_zones_to_active_plan_trigger on public.profiles;
create trigger sync_profile_zones_to_active_plan_trigger
after update of bike_ftp, run_threshold_per_mile, run_pace_unit, swim_threshold_per_100m on public.profiles
for each row execute function public.sync_profile_zones_to_active_plan();

create or replace function public.sync_plan_zones_to_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  params jsonb;
  run_text text;
  swim_text text;
  parsed_run integer;
  parsed_swim integer;
  parsed_bike integer;
  parsed_unit text;
begin
  params := new.plan -> 'params';
  if params is null then return new; end if;

  parsed_bike := nullif(coalesce(params ->> 'bikeFTP', params ->> 'bikeFtp'), '')::integer;
  run_text := params ->> 'runPace';
  swim_text := params ->> 'swimPace';
  parsed_unit := case when coalesce(params ->> 'paceUnit', '') = 'km' or lower(coalesce(run_text, '')) like '%/ km%' then 'km' else 'mile' end;

  if run_text ~ '^[0-9]{1,2}:[0-9]{2}' then
    parsed_run := split_part(run_text, ':', 1)::integer * 60
      + substring(split_part(run_text, ':', 2) from '^[0-9]{2}')::integer;
  end if;

  if swim_text ~ '^[0-9]{1,2}:[0-9]{2}' then
    parsed_swim := split_part(swim_text, ':', 1)::integer * 60
      + substring(split_part(swim_text, ':', 2) from '^[0-9]{2}')::integer;
  end if;

  update public.profiles
  set bike_ftp = coalesce(parsed_bike, bike_ftp),
      run_threshold_per_mile = coalesce(parsed_run, run_threshold_per_mile),
      run_pace_unit = coalesce(parsed_unit, run_pace_unit),
      swim_threshold_per_100m = coalesce(parsed_swim, swim_threshold_per_100m)
  where id = new.user_id
    and (
      bike_ftp is distinct from coalesce(parsed_bike, bike_ftp)
      or run_threshold_per_mile is distinct from coalesce(parsed_run, run_threshold_per_mile)
      or run_pace_unit is distinct from coalesce(parsed_unit, run_pace_unit)
      or swim_threshold_per_100m is distinct from coalesce(parsed_swim, swim_threshold_per_100m)
    );

  return new;
end;
$$;

drop trigger if exists sync_plan_zones_to_profile_trigger on public.plans;
create trigger sync_plan_zones_to_profile_trigger
after insert or update on public.plans
for each row execute function public.sync_plan_zones_to_profile();
