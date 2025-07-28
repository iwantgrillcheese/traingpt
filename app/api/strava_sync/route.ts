import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

type StravaActivityRow = { strava_id: number };

export async function POST(req: Request) {
  const supabase = createServerComponentClient({ cookies });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get Strava credentials from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('strava_access_token, strava_refresh_token, strava_expires_at')
    .eq('id', user.id)
    .single();

  if (!profile?.strava_access_token || !profile?.strava_refresh_token) {
    return NextResponse.json({ error: 'Strava not connected' }, { status: 400 });
  }

  let accessToken = profile.strava_access_token;

  // Refresh token if expired
  const now = Math.floor(Date.now() / 1000);
  if (profile.strava_expires_at < now) {
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
      console.error('[STRAVA_REFRESH_ERROR]', refreshData);
      return NextResponse.json({ error: 'Token refresh failed' }, { status: 500 });
    }

    accessToken = refreshData.access_token;

    await supabase
      .from('profiles')
      .update({
        strava_access_token: refreshData.access_token,
        strava_refresh_token: refreshData.refresh_token,
        strava_expires_at: refreshData.expires_at,
      })
      .eq('id', user.id);
  }

  // Fetch recent activities (last 14 days)
  const after = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 14;

  const res = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=200`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    console.error('[STRAVA_LIST_ERROR]', errText);
    return NextResponse.json({ error: 'Failed to fetch summary activities' }, { status: 500 });
  }

  const summaryList = await res.json();

  const { data: existing } = await supabase
    .from('strava_activities')
    .select('strava_id')
    .eq('user_id', user.id);

  const existingIds = new Set(
    existing?.map((a: StravaActivityRow) => a.strava_id)
  );

  const newSummaries = summaryList.filter((a: any) => !existingIds.has(a.id));
  const detailedActivities = [];

  for (const summary of newSummaries) {
    const detailRes = await fetch(
      `https://www.strava.com/api/v3/activities/${summary.id}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!detailRes.ok) {
      console.warn(`[DETAIL_FAIL] ${summary.id}`);
      continue;
    }

    const detail = await detailRes.json();

    detailedActivities.push({
      user_id: user.id,
      strava_id: detail.id,
      name: detail.name,
      sport_type: detail.sport_type,
      distance: detail.distance,
      moving_time: detail.moving_time,
      elapsed_time: detail.elapsed_time,
      start_date: detail.start_date,
      average_speed: detail.average_speed,
      average_heartrate: detail.average_heartrate,
      max_heartrate: detail.max_heartrate,
      average_watts: detail.average_watts,
      weighted_average_watts: detail.weighted_average_watts,
      kilojoules: detail.kilojoules,
      device_watts: detail.device_watts,
      trainer: detail.trainer,
      total_elevation_gain: detail.total_elevation_gain,
      type: detail.type,
    });

    // optional throttle to avoid rate limits
    await new Promise((r) => setTimeout(r, 150));
  }

  if (detailedActivities.length > 0) {
    const { error: insertError } = await supabase
      .from('strava_activities')
      .insert(detailedActivities);

    if (insertError) {
      console.error('[SUPABASE_INSERT_ERROR]', insertError);
      return NextResponse.json({ error: 'Insert failed' }, { status: 500 });
    }

    console.log(`✅ Inserted ${detailedActivities.length} activities`);
  } else {
    console.log('ℹ️ No new detailed activities to insert');
  }

  return NextResponse.json({
    inserted: detailedActivities.length,
    totalFetched: summaryList.length,
  });
}
