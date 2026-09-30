-- Nullable summary metadata; existing ownership and RLS policies still apply.
ALTER TABLE public.strava_activities
  ADD COLUMN IF NOT EXISTS elapsed_time integer,
  ADD COLUMN IF NOT EXISTS workout_type integer;
