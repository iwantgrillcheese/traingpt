import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

export async function POST(req: Request) {
  const supabase = createServerComponentClient({ cookies });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch Strava tokens from profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('strava_access_token, strava_refresh_token, strava_expires_at')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.strava_access_token || !profile?.strava_refresh_token) {
    return NextResponse.json({ error: 'Strava not connected' }, { status: 400 });
  }

  let accessToken = profile.strava_access_token;

  // 🔁 Refresh token if expired
  const now = Math.floor(Date.now() / 1000);
  if (profile.strava_expires_at && profile.strava_expires_at < now) {
    console.log('🔁 Refreshing Strava token…');

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
      return NextResponse.json({ error: 'Failed to refresh Strava token' }, { status: 500 });
    }

    const { access_token, refresh_token, expires_at } = refreshData;
    accessToken = access_token;

    await supabase
      .from('profiles')
      .update({
        strava_access_token: access_token,
        strava_refresh_token: refresh_token,
        strava_expires_at: expires_at,
      })
      .eq('id', user.id);
  }

  // ⏳ Optional: only fetch last 14 days of activity
  const after = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 14;

  const res = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=200`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('[STRAVA_API_ERROR]', res.status, errorText);
    return NextResponse.json({ error: 'Failed to fetch Strava activities' }, { status: 500 });
  }

  const rawActivities = await res.json();

  if (!Array.isArray(rawActivities)) {
    console.error('[STRAVA_RESPONSE_INVALID]', rawActivities);
    return NextResponse.json({ error: 'Invalid response from Strava' }, { status: 500 });
  }

  const activities = rawActivities.map((a) => ({
    user_id: user.id,
    strava_id: a.id,
    name: a.name,
    sport_type: a.sport_type,
    distance: a.distance,
    moving_time: a.moving_time,
    elapsed_time: a.elapsed_time,
    start_date: a.start_date,
    average_speed: a.average_speed,
    average_heartrate: a.average_heartrate,
    max_heartrate: a.max_heartrate,
    total_elevation_gain: a.total_elevation_gain,
    type: a.type,
  }));

  // Deduplicate by strava_id
  const { data: existingRows } = await supabase
    .from('strava_activities')
    .select('strava_id')
    .eq('user_id', user.id);

  const existingIds = new Set(existingRows?.map((row) => row.strava_id));
  const newActivities = activities.filter((a) => !existingIds.has(a.strava_id));

  if (newActivities.length > 0) {
    const { error: insertError } = await supabase
      .from('strava_activities')
      .insert(newActivities);

    if (insertError) {
      console.error('[SUPABASE_INSERT_ERROR]', insertError);
      return NextResponse.json({ error: 'Failed to insert activities' }, { status: 500 });
    }

    console.log(`✅ Inserted ${newActivities.length} new Strava activities`);
  } else {
    console.log('ℹ️ No new Strava activities to insert');
  }

  return NextResponse.json({
    inserted: newActivities.length,
    totalFetched: rawActivities.length,
  });
}
