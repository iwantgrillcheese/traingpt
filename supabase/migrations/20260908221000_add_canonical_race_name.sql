-- Keep the athlete's optional race name stable across plan rebuilds.

alter table public.profiles
  add column if not exists race_name text;

create or replace function public.apply_profile_race_name_to_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_race_name text;
begin
  select nullif(trim(race_name), '')
    into saved_race_name
    from public.profiles
    where id = new.user_id;

  if saved_race_name is not null then
    new.plan := jsonb_set(
      coalesce(new.plan, '{}'::jsonb),
      '{params}',
      coalesce(new.plan -> 'params', '{}'::jsonb)
        || jsonb_build_object('raceName', saved_race_name),
      true
    );
  end if;

  return new;
end;
$$;

drop trigger if exists apply_profile_race_name_to_plan_trigger on public.plans;
create trigger apply_profile_race_name_to_plan_trigger
before insert or update on public.plans
for each row execute function public.apply_profile_race_name_to_plan();

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
    coalesce(plan, '{}'::jsonb),
    '{params}',
    case
      when nullif(trim(new.race_name), '') is null
        then coalesce(plan -> 'params', '{}'::jsonb) - 'raceName'
      else coalesce(plan -> 'params', '{}'::jsonb)
        || jsonb_build_object('raceName', trim(new.race_name))
    end,
    true
  )
  where user_id = new.id;

  return new;
end;
$$;

drop trigger if exists sync_profile_race_name_to_active_plan_trigger on public.profiles;
create trigger sync_profile_race_name_to_active_plan_trigger
after update of race_name on public.profiles
for each row execute function public.sync_profile_race_name_to_active_plan();
