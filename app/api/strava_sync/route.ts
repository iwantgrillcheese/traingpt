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

  // Get Strava access token
  const { data: profile } = await supabase
    .from('profiles')
    .select('strava_access_token')
    .eq('id', user.id)
    .single();

  const token = profile?.strava_access_token;
  if (!token) {
    return NextResponse.json({ error: 'Strava not connected' }, { status: 400 });
  }

  // Optional: only fetch activities from the last 14 days
  const after = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 14; // last 14 days

  const res = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=200`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const rawActivities = await res.json();

  if (!Array.isArray(rawActivities)) {
    console.error('❌ Invalid Strava response:', rawActivities);
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

  // ✅ Use strava_id for deduplication
  const { data: existingRows } = await supabase
    .from('strava_activities')
    .select('strava_id')
    .eq('user_id', user.id);

  const existingIds = new Set(existingRows?.map((row) => row.strava_id));
  const newActivities = activities.filter((a) => !existingIds.has(a.strava_id));

  if (newActivities.length > 0) {
    await supabase.from('strava_activities').insert(newActivities);
    console.log(`✅ Inserted ${newActivities.length} new Strava activities`);
  } else {
    console.log('ℹ️ No new Strava activities to insert');
  }

  return NextResponse.json({ inserted: newActivities.length, totalFetched: rawActivities.length });
}
