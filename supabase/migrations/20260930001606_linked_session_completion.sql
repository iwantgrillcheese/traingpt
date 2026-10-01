-- Additive: retain all legacy records and do not invent actual completion dates.
alter table public.completed_sessions add column if not exists session_id uuid;
alter table public.completed_sessions add column if not exists completed_at timestamptz;

-- No FK: plan replacement currently deletes/recreates sessions. Keep historical
-- linkage intact rather than deleting records or turning them into legacy matches.
create unique index if not exists completed_sessions_linked_unique
  on public.completed_sessions (user_id, session_id) where session_id is not null;

-- New direct client writes must link only to a session owned by the same athlete.
create or replace function public.check_completion_session_owner()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.session_id is not null and not exists (
    select 1 from public.sessions s where s.id = new.session_id and s.user_id = new.user_id
  ) then raise exception 'Completion session does not belong to athlete'; end if;
  return new;
end;
$$;
create trigger check_completion_session_owner before insert or update of session_id, user_id
  on public.completed_sessions for each row execute function public.check_completion_session_owner();

-- Atomic status changes avoid delete/insert data loss and handle double taps.
create or replace function public.set_session_completion(
  p_session_id uuid, p_status text, p_undo boolean default false
) returns timestamptz language plpgsql security invoker set search_path = public as $$
declare v_session public.sessions%rowtype; v_completed_at timestamptz;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_status not in ('done', 'skipped') then raise exception 'Invalid status'; end if;
  select * into v_session from public.sessions where id = p_session_id and user_id = auth.uid() for update;
  if not found then raise exception 'Session not found'; end if;
  -- Remove only unlinked legacy rows that identify this session. Linked rows
  -- with the same date/title but another ID remain untouched.
  delete from public.completed_sessions where user_id = auth.uid() and session_id is null
    and date = v_session.date and lower(trim(session_title)) = lower(trim(v_session.title));
  if p_undo then
    delete from public.completed_sessions where user_id = auth.uid() and session_id = p_session_id;
    return null;
  end if;
  v_completed_at := case when p_status = 'done' then now() else null end;
  -- Keep sport NULL for linked records: the existing legacy uniqueness rule
  -- (user_id,date,sport) otherwise forbids completing two runs on one day.
  -- Linked readers take sport from sessions; legacy rows retain their sport.
  insert into public.completed_sessions (user_id, plan_id, session_id, date, session_title, status, completed_at)
    values (auth.uid(), v_session.plan_id, p_session_id, v_session.date, v_session.title, p_status, v_completed_at)
    on conflict (user_id, session_id) where session_id is not null do update
      set status = excluded.status,
          completed_at = case when completed_sessions.status = 'done' and excluded.status = 'done'
            then coalesce(completed_sessions.completed_at, excluded.completed_at) else excluded.completed_at end
    returning completed_at into v_completed_at;
  return v_completed_at;
end;
$$;
revoke all on function public.set_session_completion(uuid, text, boolean) from public, anon;
grant execute on function public.set_session_completion(uuid, text, boolean) to authenticated;
