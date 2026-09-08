-- Legacy TrainGPT plans can be stored as JSON arrays. Canonical profile fields
-- remain the source of truth for those legacy rows; only object-shaped plans
-- receive embedded params metadata.

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
    plan,
    '{params}',
    coalesce(plan -> 'params', '{}'::jsonb)
      || jsonb_build_object(
        'bikeFTP', new.bike_ftp,
        'bikeFtp', new.bike_ftp,
        'runPace', public.seconds_to_pace_text(new.run_threshold_per_mile, run_suffix),
        'paceUnit', case when new.run_pace_unit = 'km' then 'km' else 'mi' end,
        'swimPace', public.seconds_to_pace_text(new.swim_threshold_per_100m, ' / 100m')
      ),
    true
  )
  where user_id = new.id
    and jsonb_typeof(plan) = 'object';

  return new;
end;
$$;

create or replace function public.apply_profile_race_name_to_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_race_name text;
begin
  if jsonb_typeof(new.plan) <> 'object' then
    return new;
  end if;

  select nullif(trim(race_name), '')
    into saved_race_name
    from public.profiles
    where id = new.user_id;

  if saved_race_name is not null then
    new.plan := jsonb_set(
      new.plan,
      '{params}',
      coalesce(new.plan -> 'params', '{}'::jsonb)
        || jsonb_build_object('raceName', saved_race_name),
      true
    );
  end if;

  return new;
end;
$$;

create or replace function public.sync_profile_race_name_to_active_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.race_name is not distinct from old.race_name then
    return new;
  end if;

  update public.plans
  set plan = jsonb_set(
    plan,
    '{params}',
    case
      when nullif(trim(new.race_name), '') is null
        then coalesce(plan -> 'params', '{}'::jsonb) - 'raceName'
      else coalesce(plan -> 'params', '{}'::jsonb)
        || jsonb_build_object('raceName', trim(new.race_name))
    end,
    true
  )
  where user_id = new.id
    and jsonb_typeof(plan) = 'object';

  return new;
end;
$$;
