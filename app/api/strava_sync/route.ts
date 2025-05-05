// /app/api/strava_sync/route.ts
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { subDays, formatISO } from 'date-fns';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: 'No user session' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('strava_access_token')
    .eq('id', user.id)
    .single();

  const token = profile?.strava_access_token;
  if (!token) {
    return NextResponse.json({ error: 'No Strava access token' }, { status: 400 });
  }

  const afterDate = Math.floor(subDays(new Date(), 28).getTime() / 1000); // 28 days ago

  const res = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${afterDate}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const activities = await res.json();
  if (!Array.isArray(activities)) {
    return NextResponse.json({ error: 'Failed to fetch activities from Strava' }, { status: 500 });
  }

  const upserts = activities.map((a) => ({
    user_id: user.id,
    name: a.name,
    sport_type: a.sport_type,
    start_date: a.start_date,
    start_date_local: a.start_date_local,
    moving_time: a.moving_time,
    distance: a.distance,
  }));

  const { error } = await supabase
    .from('strava_activities')
    .upsert(upserts, { onConflict: ['user_id', 'start_date'] });

  if (error) {
    console.error('[SUPABASE_UPSERT_ERROR]', error);
    return NextResponse.json({ error: 'Failed to store activities' }, { status: 500 });
  }

  return NextResponse.json({ message: 'Synced successfully', count: upserts.length });
}
