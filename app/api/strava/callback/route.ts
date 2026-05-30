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
  if (!raw || !raw.startsWith('/')) return '/coaching';
  if (raw.startsWith('//')) return '/coaching';

  return raw;
}

function redirectWithParams({
  baseUrl,
  returnTo,
  params,
}: {
  baseUrl: string;
  returnTo: string;
  params: Record<string, string>;
}) {
  const redirectUrl = new URL(returnTo, baseUrl);

  for (const [key, value] of Object.entries(params)) {
    if (!redirectUrl.searchParams.has(key)) {
      redirectUrl.searchParams.set(key, value);
    }
  }

  return NextResponse.redirect(redirectUrl);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const returnTo = resolveReturnTo(url.searchParams.get('state') ?? url.searchParams.get('returnTo'));
  const baseUrl = getBaseUrl(req);

  if (!code) {
    return redirectWithParams({
      baseUrl,
      returnTo,
      params: { error: 'missing_code' },
    });
  }

  try {
    const supabase = await createRouteSupabaseClient();
    const user = await requireUser(supabase);

    if (!process.env.STRAVA_CLIENT_ID || !process.env.STRAVA_CLIENT_SECRET) {
      return redirectWithParams({
        baseUrl,
        returnTo,
        params: { error: 'strava_server_config' },
      });
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

      return redirectWithParams({
        baseUrl,
        returnTo,
        params: { error: 'strava_token_failed' },
      });
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

      return redirectWithParams({
        baseUrl,
        returnTo,
        params: { error: 'strava_profile_update_failed' },
      });
    }

    return redirectWithParams({
      baseUrl,
      returnTo,
      params: { success: 'strava_connected', sync: 'needed' },
    });
  } catch (error) {
    console.error('[strava/callback] failed:', error);

    if (error instanceof AuthError) {
      return redirectWithParams({
        baseUrl,
        returnTo,
        params: { error: 'no_user_session' },
      });
    }

    return redirectWithParams({
      baseUrl,
      returnTo,
      params: { error: 'unexpected_error' },
    });
  }
}
