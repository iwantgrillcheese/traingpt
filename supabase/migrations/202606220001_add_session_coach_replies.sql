alter table public.sessions
  add column if not exists coach_response text,
  add column if not exists coach_response_status text,
  add column if not exists coach_response_generated_at timestamptz,
  add column if not exists coach_response_note_snapshot text;

create index if not exists sessions_coach_response_pending_idx
  on public.sessions (coach_response_status, date)
  where coach_response_status = 'pending';
