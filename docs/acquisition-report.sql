-- Run using the Supabase SQL editor/admin connection, never a public client.
-- Account cohort: October 2026 in America/Los_Angeles. Change both bounds.
-- Account creation comes from auth.users, never signup-event counts.
with cohort as (
  select u.id, u.created_at, a.source,
    p.discovery_source
  from auth.users u
  join public.account_acquisition a on a.user_id = u.id
  left join public.profiles p on p.id = u.id
  where u.created_at >= timestamptz '2026-10-01 00:00:00 America/Los_Angeles'
    and u.created_at < timestamptz '2026-11-01 00:00:00 America/Los_Angeles'
    and u.deleted_at is null and not coalesce(u.is_anonymous, false)
    and a.environment = 'production'
    and not exists (select 1 from public.acquisition_exclusions x where x.user_id = u.id)
), valid_plans as (
  select distinct user_id from public.acquisition_saved_plans
  where sessions_created > 0 and saved_at < timestamptz '2026-11-01 00:00:00 America/Los_Angeles'
), repeat_schedule as (
  select user_id from public.acquisition_schedule_days
  where used_on < date '2026-11-01'
  group by user_id having count(*) >= 2
)
select c.source, count(*) as new_accounts,
  count(*) filter (where v.user_id is not null) as accounts_with_valid_saved_plan,
  count(*) filter (where r.user_id is not null) as accounts_with_repeat_schedule_usage,
  count(*) filter (where c.discovery_source is not null) as self_reported_accounts,
  round(100.0 * count(*) filter (where c.source = 'unknown/direct') /
    nullif(sum(count(*)) over (),0),2) as unknown_pct_of_all_new_accounts
from cohort c
left join valid_plans v on v.user_id = c.id
left join repeat_schedule r on r.user_id = c.id
group by c.source order by new_accounts desc;

-- Self-reported discovery stays separate from measured source.
select p.discovery_source, count(distinct u.id) as accounts
from auth.users u
join public.account_acquisition a on a.user_id = u.id and a.environment = 'production'
join public.profiles p on p.id = u.id
where u.created_at >= timestamptz '2026-10-01 00:00:00 America/Los_Angeles'
  and u.created_at < timestamptz '2026-11-01 00:00:00 America/Los_Angeles'
  and u.deleted_at is null and not coalesce(u.is_anonymous,false)
  and not exists (select 1 from public.acquisition_exclusions x where x.user_id = u.id)
  and p.discovery_source is not null
group by p.discovery_source order by accounts desc;

-- Explicit overall unknown percentage (includes consent-off production accounts).
select count(*) as production_new_accounts,
  count(*) filter (where a.source = 'unknown/direct') as unknown_accounts,
  round(100.0 * count(*) filter (where a.source = 'unknown/direct') / nullif(count(*),0),2) as unknown_percentage
from auth.users u join public.account_acquisition a on a.user_id = u.id
where u.created_at >= timestamptz '2026-10-01 00:00:00 America/Los_Angeles'
  and u.created_at < timestamptz '2026-11-01 00:00:00 America/Los_Angeles'
  and u.deleted_at is null and not coalesce(u.is_anonymous,false)
  and a.environment = 'production'
  and not exists (select 1 from public.acquisition_exclusions x where x.user_id = u.id);

-- Coverage check: do not silently treat unknown deployment origin as production.
select count(*) as accounts_without_verified_environment
from auth.users u left join public.account_acquisition a on a.user_id = u.id
where u.created_at >= timestamptz '2026-10-01 00:00:00 America/Los_Angeles'
  and u.created_at < timestamptz '2026-11-01 00:00:00 America/Los_Angeles'
  and a.user_id is null and u.deleted_at is null
  and not exists (select 1 from public.acquisition_exclusions x where x.user_id = u.id);


