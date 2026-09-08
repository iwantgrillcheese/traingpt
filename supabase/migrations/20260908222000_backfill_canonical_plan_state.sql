-- One-time repair for existing users whose active plan params drifted from the
-- canonical training metrics already stored in profiles.

update public.plans p
set plan = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          coalesce(p.plan, '{}'::jsonb),
          '{params,bikeFTP}',
          coalesce(to_jsonb(pr.bike_ftp), p.plan #> '{params,bikeFTP}', 'null'::jsonb),
          true
        ),
        '{params,bikeFtp}',
        coalesce(to_jsonb(pr.bike_ftp), p.plan #> '{params,bikeFtp}', 'null'::jsonb),
        true
      ),
      '{params,runPace}',
      case
        when pr.run_threshold_per_mile is not null then
          to_jsonb(public.seconds_to_pace_text(
            pr.run_threshold_per_mile,
            case when pr.run_pace_unit = 'km' then ' / km' else ' / mi' end
          ))
        else coalesce(p.plan #> '{params,runPace}', 'null'::jsonb)
      end,
      true
    ),
    '{params,paceUnit}',
    case
      when pr.run_threshold_per_mile is not null then to_jsonb(case when pr.run_pace_unit = 'km' then 'km' else 'mi' end)
      else coalesce(p.plan #> '{params,paceUnit}', '"mi"'::jsonb)
    end,
    true
  ),
  '{params,swimPace}',
  case
    when pr.swim_threshold_per_100m is not null then
      to_jsonb(public.seconds_to_pace_text(pr.swim_threshold_per_100m, ' / 100m'))
    else coalesce(p.plan #> '{params,swimPace}', 'null'::jsonb)
  end,
  true
)
from public.profiles pr
where p.user_id = pr.id;

-- Apply any race names that were already populated before or during the launch.
update public.plans p
set plan = jsonb_set(p.plan, '{params,raceName}', to_jsonb(trim(pr.race_name)), true)
from public.profiles pr
where p.user_id = pr.id
  and nullif(trim(pr.race_name), '') is not null;
