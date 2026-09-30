-- Rollout phase 2: apply ONLY after all server instances use the new
-- onConflict: 'user_id,strava_id' sync code. Old onConflict: 'strava_id'
-- requests cannot run once this constraint is removed.
-- Each authenticated app user owns their own copy of imported history.
ALTER TABLE public.strava_activities
  DROP CONSTRAINT IF EXISTS strava_activities_strava_id_key;
