import { NextResponse } from 'next/server';
import { AuthError, createRouteSupabaseClient, requireUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const supabase = await createRouteSupabaseClient(req);
    const user = await requireUser(supabase);
    const { error: profileError } = await supabase.from('profiles').update({ strava_access_token: null, strava_refresh_token: null, strava_expires_at: null, strava_athlete_id: null }).eq('id', user.id);
    if (profileError) { console.error('[strava/disconnect] profile update failed:', profileError); return NextResponse.json({ error: 'Failed to disconnect Strava.' }, { status: 500 }); }
    const { error: deleteError } = await supabase.from('strava_activities').delete().eq('user_id', user.id);
    if (deleteError) { console.error('[strava/disconnect] activity cleanup failed:', deleteError); return NextResponse.json({ error: 'Strava disconnected, but activity cleanup failed.' }, { status: 500 }); }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[strava/disconnect] failed:', error);
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Failed to disconnect Strava.' }, { status: 500 });
  }
}
