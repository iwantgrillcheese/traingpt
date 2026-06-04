import { createHmac, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  AuthError,
  createRouteSupabaseClient,
  requireUser,
} from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getBaseUrl(req: Request): string {
  const reqUrl = new URL(req.url);
  const forwardedProto = req.headers.get('x-forwarded-proto') ?? reqUrl.protocol.replace(':', '');
  const forwardedHost = req.headers.get('x-forwarded-host') ?? reqUrl.host;

  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;

  return process.env.NEXT_PUBLIC_BASE_URL?.trim() || reqUrl.origin;
}

function resolveReturnTo(raw: string | null): string {
  if (!raw || !raw.startsWith('/')) return '/coaching';
  if (raw.startsWith('//')) return '/coaching';

  return raw;
}

function stateSecret() {
  return process.env.STRAVA_STATE_SECRET || process.env.NEXTAUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.OPENAI_API_KEY || 'traingpt-mobile-strava-dev-secret';
}

function sign(payload: string) {
  return createHmac('sha256', stateSecret()).update(payload).digest('base64url');
}

type MobileState = {
  type: 'mobile';
  userId: string;
  appRedirect: string;
  createdAt: number;
};

function parseMobileState(raw: string | null): MobileState | null {
  if (!raw?.startsWith('mobile.')) return null;
  const [, encoded, signature] = raw.split('.');
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;

  const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as MobileState;
  if (parsed.type !== 'mobile') return null;
  if (!parsed.userId || !parsed.appRedirect?.startsWith('traingpt://')) return null;

  const ageMs = Date.now() - Number(parsed.createdAt ?? 0);
  if (ageMs < 0 || ageMs > 1000 * 60 * 20) return null;

  return parsed;
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

function redirectToApp(appRedirect: string, params: Record<string, string>) {
  const redirectUrl = new URL(appRedirect);
  for (const [key, value] of Object.entries(params)) {
    redirectUrl.searchParams.set(key, value);
  }
  return NextResponse.redirect(redirectUrl);
}

function createServiceSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('supabase_service_role_missing');
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function exchangeStravaToken(code: string) {
  if (!process.env.STRAVA_CLIENT_ID || !process.env.STRAVA_CLIENT_SECRET) {
    throw new Error('strava_server_config');
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
    throw new Error('strava_token_failed');
  }

  return tokenData;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const rawState = url.searchParams.get('state');
  const mobileState = parseMobileState(rawState);
  const returnTo = resolveReturnTo(rawState ?? url.searchParams.get('returnTo'));
  const baseUrl = getBaseUrl(req);

  if (!code) {
    if (mobileState) return redirectToApp(mobileState.appRedirect, { error: 'missing_code' });
    return redirectWithParams({ baseUrl, returnTo, params: { error: 'missing_code' } });
  }

  try {
    const tokenData = await exchangeStravaToken(code);
    const { access_token, refresh_token, expires_at, athlete } = tokenData;

    if (mobileState) {
      // Mobile returns from Strava without a reliable Supabase browser cookie.
      // The signed state already identifies the user, so use a service-role update for mobile OAuth only.
      const supabase = createServiceSupabaseClient();
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          strava_access_token: access_token,
          strava_refresh_token: refresh_token,
          strava_expires_at: expires_at,
          strava_athlete_id: athlete?.id ?? null,
        })
        .eq('id', mobileState.userId);

      if (updateError) {
        console.error('[strava/callback] mobile profile update failed:', updateError);
        return redirectToApp(mobileState.appRedirect, { error: 'strava_profile_update_failed' });
      }

      return redirectToApp(mobileState.appRedirect, { success: 'strava_connected', sync: 'needed' });
    }

    const supabase = await createRouteSupabaseClient();
    const user = await requireUser(supabase);

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
      return redirectWithParams({ baseUrl, returnTo, params: { error: 'strava_profile_update_failed' } });
    }

    return redirectWithParams({ baseUrl, returnTo, params: { success: 'strava_connected', sync: 'needed' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unexpected_error';
    console.error('[strava/callback] failed:', error);

    if (mobileState) {
      return redirectToApp(mobileState.appRedirect, { error: message || 'unexpected_error' });
    }

    if (error instanceof AuthError) {
      return redirectWithParams({ baseUrl, returnTo, params: { error: 'no_user_session' } });
    }

    return redirectWithParams({ baseUrl, returnTo, params: { error: message || 'unexpected_error' } });
  }
}
