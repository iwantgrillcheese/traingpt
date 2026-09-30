import { NextResponse } from 'next/server';
import { AuthError, createRouteSupabaseClient, requireUser } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const json = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
export async function GET(req: Request) {
  try {
    const supabase = await createRouteSupabaseClient(req);
    const user = await requireUser(supabase);
    const id = new URL(req.url).searchParams.get('id');
    if (!id || !/^\d{1,16}$/.test(id) || !Number.isSafeInteger(Number(id))) return json({ error: 'Invalid activity.' }, 400);
    const { data: activity, error: activityError } = await supabase.from('strava_activities').select('strava_id,trainer').eq('user_id', user.id).eq('strava_id', Number(id)).maybeSingle();
    if (activityError) return json({ error: 'Could not load activity.' }, 500);
    if (!activity) return json({ error: 'Activity not found.' }, 404);
    if (activity.trainer) return json({ polyline: null, reason: 'Indoor activity · no GPS route' });
    const { data: profile, error: profileError } = await supabase.from('profiles').select('strava_access_token,strava_refresh_token,strava_expires_at,strava_athlete_id').eq('id', user.id).maybeSingle();
    if (profileError) return json({ error: 'Could not load Strava connection.' }, 500);
    if (!profile?.strava_access_token) return json({ error: 'Connect Strava to view this route.' }, 409);
    let token = profile.strava_access_token;
    if (Number(profile.strava_expires_at ?? 0) <= Date.now()/1000 + 60) {
      const refreshed = await fetch('https://www.strava.com/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: process.env.STRAVA_CLIENT_ID, client_secret: process.env.STRAVA_CLIENT_SECRET, refresh_token: profile.strava_refresh_token, grant_type: 'refresh_token' }), signal: AbortSignal.timeout(8000), cache: 'no-store' });
      if (!refreshed.ok) return json({ error: 'Strava connection needs refreshing.' }, 502);
      const tokens = await refreshed.json();
      if (!tokens.access_token || !tokens.refresh_token) return json({ error: 'Could not refresh Strava.' }, 502);
      const { error } = await supabase.from('profiles').update({ strava_access_token: tokens.access_token, strava_refresh_token: tokens.refresh_token, strava_expires_at: tokens.expires_at }).eq('id', user.id);
      if (error) return json({ error: 'Could not refresh Strava.' }, 500);
      token = tokens.access_token;
    }
    const response = await fetch(`https://www.strava.com/api/v3/activities/${id}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000), cache: 'no-store' });
    if (response.status === 429) return json({ error: 'Strava is busy. Try this route again later.' }, 429);
    if (!response.ok) return json({ error: 'Route unavailable from Strava.' }, 502);
    const detail = await response.json();
    if (!profile.strava_athlete_id || String(detail.athlete?.id) !== String(profile.strava_athlete_id)) return json({ error: 'Activity not found.' }, 404);
    const polyline = detail.map?.summary_polyline;
    return json({ polyline: typeof polyline === 'string' && polyline.length <= 100000 ? polyline : null, reason: 'No GPS route available', deviceName: typeof detail.device_name === 'string' ? detail.device_name : null });
  } catch (error) {
    if (error instanceof AuthError) return json({ error: error.message }, error.status);
    return json({ error: 'Could not load this route. Try again.' }, 502);
  }
}
