import { NextResponse } from 'next/server';
import {
  AuthError,
  createRouteSupabaseClient,
  requireUser,
} from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  try {
    const supabase = await createRouteSupabaseClient();
    const user = await requireUser(supabase);

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
      console.error('[strava_disconnect] failed:', error);

      return NextResponse.json(
        { error: 'Failed to disconnect Strava.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Strava disconnected.' });
  } catch (error) {
    console.error('[strava_disconnect] failed:', error);

    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: 'Failed to disconnect Strava.' },
      { status: 500 }
    );
  }
}