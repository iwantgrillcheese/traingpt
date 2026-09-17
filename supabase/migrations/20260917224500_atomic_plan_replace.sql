create or replace function public.replace_plan_and_sessions(
  p_user_id uuid,
  p_race_date date,
  p_race_type text,
  p_plan jsonb,
  p_sessions jsonb
)
returns table(plan_id uuid, sessions_created integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id uuid;
  v_sessions_created integer := 0;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'not authorized';
  end if;

  if p_plan is null or jsonb_typeof(p_plan) <> 'object' then
    raise exception 'plan must be a JSON object';
  end if;

  if p_sessions is null or jsonb_typeof(p_sessions) <> 'array' then
    raise exception 'sessions must be a JSON array';
  end if;

  insert into public.plans (user_id, race_date, race_type, plan)
  values (p_user_id, p_race_date, p_race_type, p_plan)
  on conflict (user_id) do update
    set race_date = excluded.race_date,
        race_type = excluded.race_type,
        plan = excluded.plan
  returning id into v_plan_id;

  -- Deliberately update the plan first: the existing plan-history BEFORE UPDATE
  -- trigger snapshots the old plan and its old sessions before we replace them.
  delete from public.sessions where user_id = p_user_id;

  insert into public.sessions (
    user_id,
    plan_id,
    date,
    sport,
    title,
    session_title,
    details,
    duration,
    raw,
    status,
    strava_id,
    structured_workout
  )
  select
    p_user_id,
    v_plan_id,
    x.date,
    x.sport,
    x.title,
    x.session_title,
    x.details,
    x.duration,
    x.raw,
    coalesce(x.status, 'planned'),
    null::uuid,
    case
      when x.structured_workout is null then null
      when jsonb_typeof(x.structured_workout) = 'string' then x.structured_workout #>> '{}'
      else x.structured_workout::text
    end
  from jsonb_to_recordset(p_sessions) as x(
    date date,
    sport text,
    title text,
    session_title text,
    details text,
    duration integer,
    raw jsonb,
    status text,
    structured_workout jsonb
  );

  get diagnostics v_sessions_created = row_count;

  if v_sessions_created = 0 then
    raise exception 'generated plan produced zero persistable sessions';
  end if;

  return query select v_plan_id, v_sessions_created;
end;
$$;

revoke all on function public.replace_plan_and_sessions(uuid, date, text, jsonb, jsonb) from public;
revoke all on function public.replace_plan_and_sessions(uuid, date, text, jsonb, jsonb) from anon;
grant execute on function public.replace_plan_and_sessions(uuid, date, text, jsonb, jsonb) to authenticated;
