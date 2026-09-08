-- One-time repair for existing users whose active object-shaped plan params
-- drifted from the canonical training metrics already stored in profiles.
-- Legacy array-shaped plans remain untouched; profile fields are canonical for them.

update public.plans p
set plan = jsonb_set(
  p.plan,
  '{params}',
  coalesce(p.plan -> 'params', '{}'::jsonb)
    || jsonb_strip_nulls(
      jsonb_build_object(
        'bikeFTP', pr.bike_ftp,
        'bikeFtp', pr.bike_ftp,
        'runPace', case
          when pr.run_threshold_per_mile is not null then
            public.seconds_to_pace_text(
              pr.run_threshold_per_mile,
              case when pr.run_pace_unit = 'km' then ' / km' else ' / mi' end
            )
          else null
        end,
        'paceUnit', case
          when pr.run_threshold_per_mile is not null then
            case when pr.run_pace_unit = 'km' then 'km' else 'mi' end
          else null
        end,
        'swimPace', case
          when pr.swim_threshold_per_100m is not null then
            public.seconds_to_pace_text(pr.swim_threshold_per_100m, ' / 100m')
          else null
        end
      )
    ),
  true
)
from public.profiles pr
where p.user_id = pr.id
  and jsonb_typeof(p.plan) = 'object';

-- Apply any race names that were already populated before or during the launch.
update public.plans p
set plan = jsonb_set(
  p.plan,
  '{params}',
  coalesce(p.plan -> 'params', '{}'::jsonb)
    || jsonb_build_object('raceName', trim(pr.race_name)),
  true
)
from public.profiles pr
where p.user_id = pr.id
  and jsonb_typeof(p.plan) = 'object'
  and nullif(trim(pr.race_name), '') is not null;
