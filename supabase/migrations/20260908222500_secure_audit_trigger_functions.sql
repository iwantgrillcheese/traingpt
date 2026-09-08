-- Trigger helpers are internal database machinery, not public RPC endpoints.
-- Revoke direct API execution while preserving trigger execution.

alter function public.seconds_to_pace_text(double precision, text)
  set search_path = public;

revoke execute on function public.archive_plan_before_replace() from public, anon, authenticated;
revoke execute on function public.sync_profile_zones_to_active_plan() from public, anon, authenticated;
revoke execute on function public.sync_plan_zones_to_profile() from public, anon, authenticated;
revoke execute on function public.apply_profile_race_name_to_plan() from public, anon, authenticated;
revoke execute on function public.sync_profile_race_name_to_active_plan() from public, anon, authenticated;
