create table public.training_pauses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  plan_id uuid not null references public.plans(id),
  status text not null default 'paused' check (status in ('paused', 'resumed')),
  reason text not null check (reason in ('sick', 'injured', 'travel', 'life')),
  started_at timestamptz not null default now(),
  started_date date not null,
  expected_return_date date,
  resumed_at timestamptz,
  resumed_date date,
  resume_mode text check (resume_mode in ('normal', 'ease')),
  check ((status = 'paused' and resumed_at is null and resumed_date is null) or
    (status = 'resumed' and resumed_at is not null and resumed_date >= started_date)),
  check (expected_return_date is null or expected_return_date >= started_date)
);
create unique index training_pauses_one_active on public.training_pauses(plan_id) where status = 'paused';
alter table public.training_pauses enable row level security;
revoke all on public.training_pauses from anon, authenticated;
grant select, insert, update on public.training_pauses to authenticated;
grant all on public.training_pauses to service_role;
create policy training_pauses_read on public.training_pauses for select to authenticated using ((select auth.uid()) = user_id);
create policy training_pauses_insert on public.training_pauses for insert to authenticated
  with check ((select auth.uid()) = user_id and exists (select 1 from public.plans p where p.id = plan_id and p.user_id = (select auth.uid())));
create policy training_pauses_update on public.training_pauses for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and exists (select 1 from public.plans p where p.id = plan_id and p.user_id = (select auth.uid())));

-- Resume, plan change and session mirrors commit together. A revision check
-- prevents overwriting a drag, completion or concurrent weekly adaptation.
create or replace function public.resume_training(
  p_pause_id uuid, p_date date, p_mode text, p_original_plan jsonb,
  p_plan jsonb, p_session_updates jsonb
) returns void language plpgsql security invoker set search_path = public as $$
declare v_pause public.training_pauses%rowtype; v_plan jsonb; v_row jsonb;
begin
  select * into v_pause from public.training_pauses where id = p_pause_id and user_id = auth.uid() for update;
  if not found or v_pause.status <> 'paused' then raise exception 'Active pause not found'; end if;
  if p_mode not in ('normal','ease') or p_date < v_pause.started_date then raise exception 'Invalid resume'; end if;
  select plan into v_plan from public.plans where id = v_pause.plan_id and user_id = auth.uid() for update;
  if v_plan is distinct from p_original_plan then raise exception 'Plan changed. Refresh and try again.'; end if;
  if p_mode = 'ease' then
    perform 1 from public.sessions where user_id = auth.uid() and plan_id = v_pause.plan_id
      and id in (select (value->>'id')::uuid from jsonb_array_elements(p_session_updates)) for update;
    if exists (select 1 from jsonb_array_elements(p_session_updates) u
      left join public.sessions s on s.id = (u->>'id')::uuid and s.user_id = auth.uid() and s.plan_id = v_pause.plan_id
      where s.id is null or s.date is distinct from (u->>'expected_date')::date
        or s.title is distinct from u->>'expected_title' or s.status = 'done' or s.strava_id is not null
        or exists (select 1 from public.completed_sessions c where c.user_id = auth.uid() and c.status = 'done'
          and (c.session_id = s.id or (c.session_id is null and c.date = s.date and c.session_title = s.title))))
      then raise exception 'A session changed or was completed. Refresh and try again.';
    end if;
    update public.plans set plan = p_plan where id = v_pause.plan_id and user_id = auth.uid();
    for v_row in select * from jsonb_array_elements(p_session_updates) loop
      update public.sessions set title = v_row->>'title', session_title = v_row->>'title',
        duration = (v_row->>'duration')::numeric, details = v_row->>'details', raw = v_row->'raw'
        where id = (v_row->>'id')::uuid and user_id = auth.uid() and plan_id = v_pause.plan_id
        and coalesce(status, 'planned') <> 'done' and strava_id is null
        and not exists (select 1 from public.completed_sessions c where c.user_id = auth.uid()
          and c.status = 'done' and (c.session_id = public.sessions.id or (c.session_id is null
            and c.date = public.sessions.date and c.session_title = public.sessions.title)));
    end loop;
  end if;
  update public.training_pauses set status = 'resumed', resumed_at = now(), resumed_date = p_date, resume_mode = p_mode
    where id = p_pause_id;
end;
$$;
revoke all on function public.resume_training(uuid,date,text,jsonb,jsonb,jsonb) from public, anon;
grant execute on function public.resume_training(uuid,date,text,jsonb,jsonb,jsonb) to authenticated;
