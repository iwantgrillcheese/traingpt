-- Extend the recovered schema; no historical completion row is deleted.
alter table public.completed_sessions drop constraint if exists status_check;
alter table public.completed_sessions add constraint status_check
  check (status in ('done', 'skipped', 'planned') or status is null) not valid;

create or replace function public.set_session_completion(
  p_session_id uuid, p_status text, p_undo boolean default false
) returns timestamptz language plpgsql security invoker set search_path = public as $$
declare v_session public.sessions%rowtype; v_at timestamptz; v_legacy uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_status is null or p_status not in ('done','skipped') then raise exception 'Invalid status'; end if;
  select * into v_session from public.sessions where id = p_session_id and user_id = auth.uid() for update;
  if not found then raise exception 'Session not found'; end if;
  -- Promote one historical row to stable identity, retaining its ID/timestamp.
  -- Any duplicate legacy history remains stored, but ID-first readers use the
  -- authoritative linked state. Null sport avoids the legacy one-sport/day key.
  if not exists (select 1 from public.completed_sessions where user_id = auth.uid() and session_id = p_session_id) then
    select id into v_legacy from public.completed_sessions where user_id = auth.uid() and session_id is null
      and date = v_session.date and lower(trim(session_title)) = lower(trim(v_session.title))
      order by created_at desc, id limit 1 for update;
    if v_legacy is not null then
      update public.completed_sessions set session_id = p_session_id, plan_id = v_session.plan_id, sport = null where id = v_legacy;
    end if;
  end if;
  v_at := case when not coalesce(p_undo,false) and p_status = 'done' then now() else null end;
  insert into public.completed_sessions(user_id,plan_id,session_id,date,session_title,status,completed_at)
  values(auth.uid(),v_session.plan_id,p_session_id,v_session.date,v_session.title,
    case when coalesce(p_undo,false) then 'planned' else p_status end,v_at)
  on conflict (user_id,session_id) where session_id is not null do update set
    status = excluded.status,
    completed_at = case when completed_sessions.status = 'done' and excluded.status = 'done'
      then coalesce(completed_sessions.completed_at,excluded.completed_at) else excluded.completed_at end
  returning completed_at into v_at;
  return v_at;
end;
$$;
revoke all on function public.set_session_completion(uuid,text,boolean) from public,anon;
grant execute on function public.set_session_completion(uuid,text,boolean) to authenticated;

create or replace function public.move_training_session(p_session_id uuid, p_date date)
returns void language plpgsql security invoker set search_path = public as $$
declare s public.sessions%rowtype; params jsonb; allowed jsonb; day_name text; legacy uuid;
begin
  if auth.uid() is null or p_date is null then raise exception 'Not authenticated or invalid date'; end if;
  select * into s from public.sessions where id = p_session_id and user_id = auth.uid() for update;
  if not found then raise exception 'Session not found'; end if;
  select plan->'params' into params from public.plans where id = s.plan_id and user_id = auth.uid();
  day_name := trim(to_char(p_date,'Day'));
  allowed := coalesce(params->'athleteContext'->'context'->'sportAvailability'->lower(s.sport), params->'sportAvailability'->lower(s.sport));
  if (allowed is not null and not allowed ? day_name)
    or day_name = coalesce(params->'athleteContext'->'context'->>'restDay',params->>'restDay')
    or coalesce(params->'unavailableDays','[]') ? day_name
    or coalesce(params->'athleteContext'->'context'->'unavailableDays','[]') ? day_name
  then raise exception 'That day conflicts with confirmed availability'; end if;
  if not exists (select 1 from public.completed_sessions where user_id = auth.uid() and session_id = s.id) then
    select id into legacy from public.completed_sessions where user_id = auth.uid() and session_id is null
      and date = s.date and lower(trim(session_title)) = lower(trim(s.title)) order by created_at desc,id limit 1 for update;
    if legacy is not null then
      update public.completed_sessions set session_id = s.id,plan_id = s.plan_id,sport = null where id = legacy;
    end if;
  end if;
  update public.sessions set date = p_date where id = s.id and user_id = auth.uid();
end;
$$;
revoke all on function public.move_training_session(uuid,date) from public,anon;
grant execute on function public.move_training_session(uuid,date) to authenticated;
