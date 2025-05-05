// /app/api/strava/callback/route.ts
import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const url = new URL(req.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`https://www.traingpt.co/coaching?error=missing_code`);
  }

  try {
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
      console.error('[STRAVA_TOKEN_ERROR]', tokenData);
      return NextResponse.redirect(`https://www.traingpt.co/coaching?error=strava_token_failed`);
    }

    const { access_token, refresh_token, expires_at, athlete } = tokenData;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      console.error('[NO_USER]', null);
      return NextResponse.redirect(`https://www.traingpt.co/coaching?error=no_user_session`);
    }

    await supabase
      .from('profiles')
      .update({
        strava_access_token: access_token,
        strava_refresh_token: refresh_token,
        strava_expires_at: expires_at,
        strava_athlete_id: athlete?.id,
      })
      .eq('id', user.id);

    // Trigger Strava sync after successful connection
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/strava_sync`, {
      headers: {
        Cookie: req.headers.get('cookie') ?? '',
      },
    });

    return NextResponse.redirect(`https://www.traingpt.co/coaching?success=strava_connected`);
  } catch (err) {
    console.error('[STRAVA_CALLBACK_ERROR]', err);
    return NextResponse.redirect(`https://www.traingpt.co/coaching?error=unexpected_error`);
  }
}
