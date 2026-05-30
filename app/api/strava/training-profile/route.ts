import { NextResponse } from 'next/server';
import {
  AuthError,
  createRouteSupabaseClient,
  requireUser,
} from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type StravaActivityRow = {
  id?: string;
  name: string | null;
  sport_type: string | null;
  distance: number | null;
  moving_time: number | null;
  start_date: string | null;
  average_speed: number | null;
  average_heartrate: number | null;
  average_watts: number | null;
  weighted_average_watts: number | null;
  total_elevation_gain: number | null;
};

type Discipline = 'swim' | 'bike' | 'run';

type ThresholdEstimate = {
  discipline: Discipline;
  label: string;
  value: string;
  confidence: 'low' | 'medium' | 'high';
  rationale: string;
};

type Callout = {
  title: string;
  body: string;
  tone: 'wow' | 'signal' | 'caution';
};

function miles(meters?: number | null) {
  return Number(meters ?? 0) / 1609.344;
}

function feet(meters?: number | null) {
  return Number(meters ?? 0) * 3.28084;
}

function pacePerMile(seconds: number) {
  const rounded = Math.round(seconds);
  const min = Math.floor(rounded / 60);
  const sec = rounded % 60;
  return `${min}:${String(sec).padStart(2, '0')} / mi`;
}

function pacePer100m(seconds: number) {
  const rounded = Math.round(seconds);
  const min = Math.floor(rounded / 60);
  const sec = rounded % 60;
  return `${min}:${String(sec).padStart(2, '0')} / 100m`;
}

function formatMiles(value: number) {
  if (value >= 95) return `${Math.round(value)} miles`;
  if (value >= 10) return `${value.toFixed(1)} miles`;
  return `${value.toFixed(2)} miles`;
}

function formatFeet(value: number) {
  return `${Math.round(value).toLocaleString()} ft`;
}

function sport(row: StravaActivityRow) {
  return String(row.sport_type ?? '').toLowerCase();
}

function validDuration(row: StravaActivityRow) {
  return typeof row.moving_time === 'number' && Number.isFinite(row.moving_time) && row.moving_time > 0;
}

function validDistance(row: StravaActivityRow) {
  return typeof row.distance === 'number' && Number.isFinite(row.distance) && row.distance > 0;
}

function activityPaceSecondsPerMile(row: StravaActivityRow) {
  if (!validDuration(row) || !validDistance(row)) return null;
  const mi = miles(row.distance);
  if (mi <= 0) return null;
  return Number(row.moving_time) / mi;
}

function dateMs(row: StravaActivityRow) {
  const ms = new Date(row.start_date ?? '').getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function bestRunNearDistance(runs: StravaActivityRow[], targetMiles: number, tolerance = 0.18) {
  const lower = targetMiles * (1 - tolerance);
  const upper = targetMiles * (1 + tolerance);

  return runs
    .filter((row) => {
      const distance = miles(row.distance);
      return distance >= lower && distance <= upper && validDuration(row);
    })
    .sort((a, b) => Number(a.moving_time) - Number(b.moving_time))[0] ?? null;
}

function recentRows(rows: StravaActivityRow[], days: number) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return rows.filter((row) => dateMs(row) >= cutoff);
}

function estimateRunThreshold(runs: StravaActivityRow[]): ThresholdEstimate {
  const tenK = bestRunNearDistance(runs, 6.21, 0.22);
  const half = bestRunNearDistance(runs, 13.1, 0.12);
  const marathon = bestRunNearDistance(runs, 26.2, 0.08);
  const qualityRuns = runs
    .filter((row) => {
      const distance = miles(row.distance);
      return distance >= 3 && distance <= 14 && validDuration(row);
    })
    .sort((a, b) => (activityPaceSecondsPerMile(a) ?? 99999) - (activityPaceSecondsPerMile(b) ?? 99999));

  if (tenK) {
    const pace = activityPaceSecondsPerMile(tenK)!;
    return {
      discipline: 'run',
      label: 'Run threshold pace',
      value: pacePerMile(pace * 1.055),
      confidence: 'high',
      rationale: `Based on a ${pacePerMile(pace)} 10K-type effort. For this camp, starting threshold slightly slower is the safer training target.`,
    };
  }

  if (half) {
    const pace = activityPaceSecondsPerMile(half)!;
    return {
      discipline: 'run',
      label: 'Run threshold pace',
      value: pacePerMile(pace * 0.985),
      confidence: 'medium',
      rationale: `Based on a half-marathon-type effort at ${pacePerMile(pace)}. Threshold estimate is nudged slightly faster than HM pace.`,
    };
  }

  if (marathon) {
    const pace = activityPaceSecondsPerMile(marathon)!;
    return {
      discipline: 'run',
      label: 'Run threshold pace',
      value: pacePerMile(pace * 0.94),
      confidence: 'medium',
      rationale: `Based on a marathon-distance effort at ${pacePerMile(pace)}. Threshold is estimated faster than marathon pace.`,
    };
  }

  if (qualityRuns[0]) {
    const pace = activityPaceSecondsPerMile(qualityRuns[0])!;
    return {
      discipline: 'run',
      label: 'Run threshold pace',
      value: pacePerMile(pace * 1.08),
      confidence: 'low',
      rationale: `Based on your quickest recent run signal. Treat this as a starting point, not a lab-tested threshold.`,
    };
  }

  return {
    discipline: 'run',
    label: 'Run threshold pace',
    value: 'Not enough run data',
    confidence: 'low',
    rationale: 'Connect more run data or enter this manually if you know your current threshold pace.',
  };
}

function estimateBikeThreshold(rides: StravaActivityRow[]): ThresholdEstimate {
  const candidates = rides
    .filter((row) => validDuration(row) && Number(row.moving_time) >= 20 * 60 && (row.weighted_average_watts || row.average_watts))
    .map((row) => {
      const watts = Number(row.weighted_average_watts ?? row.average_watts);
      const duration = Number(row.moving_time);
      const estimate = duration <= 45 * 60 ? watts * 0.95 : watts;
      return { row, estimate };
    })
    .sort((a, b) => b.estimate - a.estimate);

  if (candidates[0]) {
    const estimate = Math.round(candidates[0].estimate);
    return {
      discipline: 'bike',
      label: 'Bike threshold / FTP',
      value: `${estimate}W`,
      confidence: candidates[0].row.weighted_average_watts ? 'medium' : 'low',
      rationale: candidates[0].row.weighted_average_watts
        ? 'Estimated from your strongest weighted-power ride signal. Use your known FTP if you have a recent test.'
        : 'Estimated from average power because weighted power was limited. Use this conservatively.',
    };
  }

  return {
    discipline: 'bike',
    label: 'Bike threshold / FTP',
    value: 'Not enough power data',
    confidence: 'low',
    rationale: 'No reliable ride power signal was found. Enter FTP manually if you know it.',
  };
}

function estimateSwimThreshold(swims: StravaActivityRow[]): ThresholdEstimate {
  const candidates = swims
    .filter((row) => validDuration(row) && validDistance(row) && Number(row.distance) >= 400)
    .map((row) => ({ row, pace100: Number(row.moving_time) / (Number(row.distance) / 100) }))
    .sort((a, b) => a.pace100 - b.pace100);

  if (candidates[0]) {
    return {
      discipline: 'swim',
      label: 'Swim threshold pace',
      value: pacePer100m(candidates[0].pace100 * 1.04),
      confidence: 'low',
      rationale: 'Estimated from your fastest recent swim pace. GPS/pool recording can be messy, so confirm manually if you know CSS.',
    };
  }

  return {
    discipline: 'swim',
    label: 'Swim threshold pace',
    value: 'Not enough swim data',
    confidence: 'low',
    rationale: 'No reliable swim signal was found. Enter CSS or threshold pace manually if you know it.',
  };
}

function buildCallouts(rows: StravaActivityRow[]): Callout[] {
  const rides = rows.filter((row) => sport(row) === 'bike' || sport(row) === 'ride');
  const runs = rows.filter((row) => sport(row) === 'run');
  const swims = rows.filter((row) => sport(row) === 'swim');
  const callouts: Callout[] = [];

  const longestRide = rides.filter(validDistance).sort((a, b) => Number(b.distance) - Number(a.distance))[0];
  if (longestRide) {
    const rideMiles = miles(longestRide.distance);
    const elevation = feet(longestRide.total_elevation_gain);
    if (rideMiles >= 80) {
      callouts.push({
        title: `Big engine: ${formatMiles(rideMiles)} ride`,
        body: `Your longest ride was ${formatMiles(rideMiles)}${elevation > 500 ? ` with ${formatFeet(elevation)} of climbing` : ''}. That is a real endurance signal for long-course racing.`,
        tone: 'wow',
      });
    }
  }

  const marathon = bestRunNearDistance(runs, 26.2, 0.08);
  if (marathon) {
    const pace = activityPaceSecondsPerMile(marathon)!;
    callouts.push({
      title: `Marathon strength: ${pacePerMile(pace)}`,
      body: `A marathon-type run at ${pacePerMile(pace)} suggests you have serious durability. We should protect that with smart bike/run load, not bury it.`,
      tone: 'wow',
    });
  }

  const tenK = bestRunNearDistance(runs, 6.21, 0.22);
  if (tenK) {
    const pace = activityPaceSecondsPerMile(tenK)!;
    callouts.push({
      title: `Run speed signal: ${pacePerMile(pace)} 10K-type effort`,
      body: `That points to a useful threshold starting point. We’ll still avoid overcooking early run volume if recent consistency is light.`,
      tone: 'signal',
    });
  }

  const recentRunCount = recentRows(runs, 21).length;
  if (recentRunCount <= 3 && runs.length >= 8) {
    callouts.push({
      title: 'Run frequency looks light lately',
      body: `You have historical run fitness, but only ${recentRunCount} runs in the last 3 weeks. The plan should rebuild frequency before adding too much intensity.`,
      tone: 'caution',
    });
  }

  if (swims.length <= 2 && rows.length >= 15) {
    callouts.push({
      title: 'Swim data is thin',
      body: 'There is not much swim history here, so swim threshold should be treated as an estimate unless you enter CSS manually.',
      tone: 'caution',
    });
  }

  if (!callouts.length) {
    callouts.push({
      title: 'Training history connected',
      body: 'TrainGPT found enough activity history to start calibrating your plan. Review the estimates below before continuing.',
      tone: 'signal',
    });
  }

  return callouts.slice(0, 4);
}

export async function GET() {
  try {
    const supabase = await createRouteSupabaseClient();
    const user = await requireUser(supabase);
    const sinceISO = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('strava_activities')
      .select('name,sport_type,distance,moving_time,start_date,average_speed,average_heartrate,average_watts,weighted_average_watts,total_elevation_gain')
      .eq('user_id', user.id)
      .gte('start_date', sinceISO)
      .order('start_date', { ascending: false })
      .limit(300);

    if (error) {
      console.error('[strava/training-profile] lookup failed', error);
      return NextResponse.json({ error: 'Could not read Strava activities.' }, { status: 500 });
    }

    const rows = (Array.isArray(data) ? data : []) as StravaActivityRow[];
    const runs = rows.filter((row) => sport(row) === 'run');
    const rides = rows.filter((row) => sport(row) === 'bike' || sport(row) === 'ride');
    const swims = rows.filter((row) => sport(row) === 'swim');

    return NextResponse.json({
      activityCount: rows.length,
      sportCounts: {
        run: runs.length,
        bike: rides.length,
        swim: swims.length,
      },
      callouts: buildCallouts(rows),
      estimates: [estimateSwimThreshold(swims), estimateBikeThreshold(rides), estimateRunThreshold(runs)],
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('[strava/training-profile] failed', error);
    return NextResponse.json({ error: 'Failed to build Strava training profile.' }, { status: 500 });
  }
}
