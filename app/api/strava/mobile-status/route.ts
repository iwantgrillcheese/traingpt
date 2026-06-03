import { NextResponse } from 'next/server';
import { AuthError, createRouteSupabaseClient, requireUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function sportBucket(value?: string | null) {
  const sport = String(value ?? '').toLowerCase();
  if (sport.includes('run')) return 'run';
  if (sport.includes('ride') || sport.includes('bike') || sport.includes('cycle')) return 'bike';
  if (sport.includes('swim')) return 'swim';
  return 'other';
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
        .select('sport_type,type,moving_time,start_date,start_date_local')
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

    const typedActivities = (activities ?? []) as Array<{
      sport_type?: string | null;
      type?: string | null;
      moving_time?: number | null;
      start_date?: string | null;
      start_date_local?: string | null;
    }>;

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
    });
  } catch (error) {
    console.error('[strava/mobile-status] failed:', error);
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not load Strava status.' }, { status: 500 });
  }
}
