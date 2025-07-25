import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { subDays } from 'date-fns';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: 'No user session' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('strava_access_token, strava_refresh_token, strava_expires_at')
    .eq('id', user.id)
    .single();

  if (!profile?.strava_access_token || !profile.strava_refresh_token) {
    console.error('[NO STRAVA TOKENS]', profile);
    return NextResponse.json({ error: 'Missing Strava token' }, { status: 400 });
  }

  let token = profile.strava_access_token;

  if (profile.strava_expires_at * 1000 < Date.now()) {
    const refreshRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: profile.strava_refresh_token,
      }),
    });

    const refreshData = await refreshRes.json();

    if (!refreshRes.ok) {
      console.error('[STRAVA TOKEN REFRESH FAILED]', refreshData);
      return NextResponse.json({ error: 'Token refresh failed' }, { status: 401 });
    }

    token = refreshData.access_token;

    await supabase
      .from('profiles')
      .update({
        strava_access_token: refreshData.access_token,
        strava_refresh_token: refreshData.refresh_token,
        strava_expires_at: refreshData.expires_at,
      })
      .eq('id', user.id);
  }

  const after = Math.floor(subDays(new Date(), 30).setHours(0, 0, 0, 0) / 1000);
  const before = Math.floor(new Date().getTime() / 1000);

  const res = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?after=${after}&before=${before}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  let activities;
  try {
    activities = await res.json();
  } catch (err) {
    console.error('[STRAVA RESPONSE ERROR]', err);
    return NextResponse.json({ error: 'Failed to parse Strava response' }, { status: 500 });
  }

  if (!Array.isArray(activities)) {
    console.error('[STRAVA RESPONSE FORMAT ERROR]', activities);
    return NextResponse.json({ error: 'Invalid Strava response' }, { status: 500 });
  }

  const upserts = activities.map((a) => ({
    user_id: user.id,
    strava_id: a.id,
    name: a.name,
    sport_type: (a.sport_type ?? '').trim().toLowerCase(),
    start_date: a.start_date,
    start_date_local: a.start_date_local,
    moving_time: a.moving_time,
    distance: a.distance,
  }));

  const { error } = await supabase
    .from('strava_activities')
    .upsert(upserts, { onConflict: 'strava_id' });

  if (error) {
    console.error('[SUPABASE_UPSERT_ERROR]', error);
    return NextResponse.json({ error: 'Failed to store Strava activities' }, { status: 500 });
  }

  return NextResponse.json({ message: 'Strava sync complete', count: upserts.length });
}
