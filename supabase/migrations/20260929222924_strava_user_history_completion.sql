-- Rollout phase 1: additive schema, compatible with the old application.
-- Apply this migration before deploying the new sync/callback/reveal code.
-- Production already has this constraint; create it on older installations.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.strava_activities'::regclass AND conname = 'strava_activities_unique_user_stravaid') THEN
    ALTER TABLE public.strava_activities ADD CONSTRAINT strava_activities_unique_user_stravaid UNIQUE (user_id, strava_id);
  END IF;
END $$;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS strava_history_imported_at timestamptz;
-- Do not backfill from last_synced_at: previous successful syncs could have
-- silently skipped every row or fetched only incremental history.
