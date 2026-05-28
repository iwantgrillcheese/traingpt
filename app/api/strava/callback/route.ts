import { NextResponse } from 'next/server';
import {
  AuthError,
  createRouteSupabaseClient,
  requireUser,
} from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getBaseUrl(req: Request): string {
  const reqUrl = new URL(req.url);

  return (
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    `${req.headers.get('x-forwarded-proto') ?? reqUrl.protocol.replace(':', '')}://${
      req.headers.get('x-forwarded-host') ?? reqUrl.host
    }`
  );
}

function resolveReturnTo(raw: string | null): string {
  if (!raw || !raw.startsWith('/')) return '/coaching?success=strava_connected';
  if (raw.startsWith('//')) return '/coaching?success=strava_connected';

  return raw;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const returnTo = resolveReturnTo(url.searchParams.get('state') ?? url.searchParams.get('returnTo'));
  const baseUrl = getBaseUrl(req);

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/coaching?error=missing_code`);
  }

  try {
    const supabase = await createRouteSupabaseClient();
    const user = await requireUser(supabase);

    if (!process.env.STRAVA_CLIENT_ID || !process.env.STRAVA_CLIENT_SECRET) {
      return NextResponse.redirect(`${baseUrl}/coaching?error=strava_server_config`);
    }

    const tokenRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error('[strava/callback] token exchange failed:', tokenData);

      return NextResponse.redirect(`${baseUrl}/coaching?error=strava_token_failed`);
    }

    const { access_token, refresh_token, expires_at, athlete } = tokenData;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        strava_access_token: access_token,
        strava_refresh_token: refresh_token,
        strava_expires_at: expires_at,
        strava_athlete_id: athlete?.id ?? null,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('[strava/callback] profile update failed:', updateError);

      return NextResponse.redirect(`${baseUrl}/coaching?error=strava_profile_update_failed`);
    }

    const redirectUrl = new URL(returnTo, baseUrl);

    if (!redirectUrl.searchParams.has('success')) {
      redirectUrl.searchParams.set('success', 'strava_connected');
    }

    if (!redirectUrl.searchParams.has('sync')) {
      redirectUrl.searchParams.set('sync', 'needed');
    }

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('[strava/callback] failed:', error);

    if (error instanceof AuthError) {
      return NextResponse.redirect(`${baseUrl}/coaching?error=no_user_session`);
    }

    return NextResponse.redirect(`${baseUrl}/coaching?error=unexpected_error`);
  }
}