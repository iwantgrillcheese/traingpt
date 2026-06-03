import { NextResponse } from 'next/server';
import { AuthError, createRouteSupabaseClient, requireUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ActivityRow = {
  name?: string | null;
  sport_type?: string | null;
  type?: string | null;
  moving_time?: number | null;
  distance?: number | null;
  start_date?: string | null;
  start_date_local?: string | null;
  average_speed?: number | null;
  total_elevation_gain?: number | null;
};

function sportBucket(value?: string | null) {
  const sport = String(value ?? '').toLowerCase();
  if (sport.includes('run')) return 'run';
  if (sport.includes('ride') || sport.includes('bike') || sport.includes('cycle')) return 'bike';
  if (sport.includes('swim')) return 'swim';
  return 'other';
}

function miles(meters?: number | null) {
  return Number(meters ?? 0) / 1609.344;
}

function yards(meters?: number | null) {
  return Number(meters ?? 0) * 1.09361;
}

function feet(meters?: number | null) {
  return Number(meters ?? 0) * 3.28084;
}

function formatDuration(seconds?: number | null) {
  const total = Math.round(Number(seconds ?? 0));
  if (!Number.isFinite(total) || total <= 0) return null;
  const hours = Math.floor(total / 3600);
  const minutes = Math.round((total % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatMiles(value: number) {
  if (value >= 100) return `${Math.round(value)} mi`;
  if (value >= 10) return `${value.toFixed(1)} mi`;
  return `${value.toFixed(2)} mi`;
}

function formatYards(value: number) {
  if (value >= 1760) return `${(value / 1760).toFixed(1)} mi swim`;
  return `${Math.round(value).toLocaleString()} yd`;
}

function pacePerMile(row: ActivityRow) {
  const distanceMi = miles(row.distance);
  const seconds = Number(row.moving_time ?? 0);
  if (distanceMi <= 0 || seconds <= 0) return null;
  const pace = Math.round(seconds / distanceMi);
  const min = Math.floor(pace / 60);
  const sec = pace % 60;
  return `${min}:${String(sec).padStart(2, '0')} /mi`;
}

function pacePer100m(row: ActivityRow) {
  const distanceM = Number(row.distance ?? 0);
  const seconds = Number(row.moving_time ?? 0);
  if (distanceM <= 0 || seconds <= 0) return null;
  const pace = Math.round(seconds / (distanceM / 100));
  const min = Math.floor(pace / 60);
  const sec = pace % 60;
  return `${min}:${String(sec).padStart(2, '0')} /100m`;
}

function validDistance(row: ActivityRow) {
  return typeof row.distance === 'number' && Number.isFinite(row.distance) && row.distance > 0;
}

function validDuration(row: ActivityRow) {
  return typeof row.moving_time === 'number' && Number.isFinite(row.moving_time) && row.moving_time > 0;
}

function buildHighlight({ label, value, detail, tone = 'signal' }: { label: string; value: string; detail: string; tone?: 'wow' | 'signal' | 'steady' }) {
  return { label, value, detail, tone };
}

function buildHighlights(rows: ActivityRow[]) {
  const rides = rows.filter((row) => sportBucket(row.sport_type ?? row.type) === 'bike');
  const runs = rows.filter((row) => sportBucket(row.sport_type ?? row.type) === 'run');
  const swims = rows.filter((row) => sportBucket(row.sport_type ?? row.type) === 'swim');
  const highlights: Array<{ label: string; value: string; detail: string; tone: 'wow' | 'signal' | 'steady' }> = [];

  const longestRide = rides.filter(validDistance).sort((a, b) => Number(b.distance ?? 0) - Number(a.distance ?? 0))[0];
  if (longestRide) {
    const rideMi = miles(longestRide.distance);
    const duration = formatDuration(longestRide.moving_time);
    const elevation = feet(longestRide.total_elevation_gain);
    highlights.push(buildHighlight({
      label: 'Longest ride',
      value: formatMiles(rideMi),
      detail: `${duration ? `${duration} · ` : ''}${elevation >= 500 ? `${Math.round(elevation).toLocaleString()} ft climbing` : 'Endurance base detected'}`,
      tone: rideMi >= 50 ? 'wow' : 'signal',
    }));
  }

  const longestRun = runs.filter(validDistance).sort((a, b) => Number(b.distance ?? 0) - Number(a.distance ?? 0))[0];
  if (longestRun) {
    const runMi = miles(longestRun.distance);
    highlights.push(buildHighlight({
      label: 'Longest run',
      value: formatMiles(runMi),
      detail: `${pacePerMile(longestRun) ?? formatDuration(longestRun.moving_time) ?? 'Durability signal'} · run durability`,
      tone: runMi >= 10 ? 'wow' : 'signal',
    }));
  }

  const bestRun = runs
    .filter((row) => validDistance(row) && validDuration(row) && miles(row.distance) >= 2.5)
    .sort((a, b) => {
      const paceA = Number(a.moving_time) / miles(a.distance);
      const paceB = Number(b.moving_time) / miles(b.distance);
      return paceA - paceB;
    })[0];
  if (bestRun) {
    highlights.push(buildHighlight({
      label: 'Best run signal',
      value: pacePerMile(bestRun) ?? 'Strong run',
      detail: `${formatMiles(miles(bestRun.distance))} effort · helps set run progression`,
      tone: 'signal',
    }));
  }

  const longestSwim = swims.filter(validDistance).sort((a, b) => Number(b.distance ?? 0) - Number(a.distance ?? 0))[0];
  if (longestSwim) {
    highlights.push(buildHighlight({
      label: 'Longest swim',
      value: formatYards(yards(longestSwim.distance)),
      detail: `${pacePer100m(longestSwim) ?? formatDuration(longestSwim.moving_time) ?? 'Swim base detected'} · swim history included`,
      tone: 'steady',
    }));
  }

  if (!highlights.length && rows.length > 0) {
    highlights.push(buildHighlight({
      label: 'Training history found',
      value: `${rows.length} activities`,
      detail: 'TrainGPT will use your activity history to calibrate your starting point.',
      tone: 'signal',
    }));
  }

  return highlights.slice(0, 4);
}

export async function GET(req: Request) {
  try {
    const supabase = await createRouteSupabaseClient(req);
    const user = await requireUser(supabase);

    const [{ data: profile, error: profileError }, { data: activities, error: activitiesError }, { count }] = await Promise.all([
      supabase
        .from('profiles')
        .select('strava_access_token,strava_refresh_token,strava_athlete_id')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('strava_activities')
        .select('name,sport_type,type,moving_time,distance,start_date,start_date_local,average_speed,total_elevation_gain')
        .eq('user_id', user.id)
        .order('start_date', { ascending: false })
        .limit(180),
      supabase
        .from('strava_activities')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
    ]);

    if (profileError) throw profileError;
    if (activitiesError) throw activitiesError;

    const typedProfile = profile as {
      strava_access_token?: string | null;
      strava_refresh_token?: string | null;
      strava_athlete_id?: string | number | null;
    } | null;

    const typedActivities = (activities ?? []) as ActivityRow[];

    const totalSeconds = typedActivities.reduce((sum, activity) => sum + Number(activity.moving_time ?? 0), 0);
    const counts = typedActivities.reduce(
      (acc, activity) => {
        const bucket = sportBucket(activity.sport_type ?? activity.type);
        if (bucket === 'run') acc.run += 1;
        if (bucket === 'bike') acc.bike += 1;
        if (bucket === 'swim') acc.swim += 1;
        return acc;
      },
      { run: 0, bike: 0, swim: 0 }
    );

    const latestActivity = typedActivities[0] ?? null;
    const connected = Boolean(typedProfile?.strava_access_token || typedProfile?.strava_refresh_token || typedProfile?.strava_athlete_id);

    return NextResponse.json({
      connected,
      athleteId: typedProfile?.strava_athlete_id ? String(typedProfile.strava_athlete_id) : null,
      activityCount: count ?? typedActivities.length,
      recentActivityCount: typedActivities.length,
      totalHours: Math.round((totalSeconds / 3600) * 10) / 10,
      runCount: counts.run,
      bikeCount: counts.bike,
      swimCount: counts.swim,
      latestActivityDate: latestActivity?.start_date_local ?? latestActivity?.start_date ?? null,
      highlights: buildHighlights(typedActivities),
    });
  } catch (error) {
    console.error('[strava/mobile-status] failed:', error);
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not load Strava status.' }, { status: 500 });
  }
}
