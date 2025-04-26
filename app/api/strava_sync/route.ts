// app/api/strava/sync/route.ts
import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const supabase = createServerComponentClient({ cookies });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('strava_access_token')
    .eq('id', session.user.id)
    .single();

  if (!profile?.strava_access_token) {
    return NextResponse.json({ error: 'No Strava access token found' }, { status: 400 });
  }

  try {
    const res = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=50', {
      headers: {
        Authorization: `Bearer ${profile.strava_access_token}`,
      },
    });

    const activities = await res.json();

    if (!Array.isArray(activities)) {
      console.error('[STRAVA_API_ERROR]', activities);
      return NextResponse.json({ error: 'Invalid Strava response' }, { status: 500 });
    }

    const rows = activities.map((act) => ({
      id: act.id,
      user_id: session.user.id,
      name: act.name,
      sport_type: act.sport_type,
      start_date: act.start_date,
      start_date_local: act.start_date_local,
      moving_time: act.moving_time,
      distance: act.distance,
      manual: act.manual || false,
    }));

    if (rows.length > 0) {
      const { error: insertError } = await supabase.from('strava_activities').upsert(rows, { onConflict: 'id' });

      if (insertError) {
        console.error('[SUPABASE_INSERT_ERROR]', insertError);
        return NextResponse.json({ error: 'Failed to save activities' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, count: rows.length });
  } catch (err) {
    console.error('[STRAVA_SYNC_ERROR]', err);
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}
