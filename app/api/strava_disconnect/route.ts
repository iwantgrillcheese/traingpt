// /app/api/strava_disconnect/route.ts
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  const supabase = createRouteHandlerClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ error: 'No user session' }, { status: 401 });
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      strava_access_token: null,
      strava_refresh_token: null,
      strava_expires_at: null,
      strava_athlete_id: null,
    })
    .eq('id', user.id);

  if (error) {
    console.error('[STRAVA_DISCONNECT_ERROR]', error);
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }

  return NextResponse.json({ message: 'Strava disconnected' });
}
