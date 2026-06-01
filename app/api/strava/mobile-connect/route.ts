import { createHmac } from 'crypto';
import { NextResponse } from 'next/server';
import { AuthError, createRouteSupabaseClient, requireUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getBaseUrl(req: Request): string {
  const reqUrl = new URL(req.url);
  const forwardedProto = req.headers.get('x-forwarded-proto') ?? reqUrl.protocol.replace(':', '');
  const forwardedHost = req.headers.get('x-forwarded-host') ?? reqUrl.host;
  return forwardedHost ? `${forwardedProto}://${forwardedHost}` : process.env.NEXT_PUBLIC_BASE_URL?.trim() || reqUrl.origin;
}

function stateSecret() {
  return process.env.STRAVA_STATE_SECRET || process.env.NEXTAUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.OPENAI_API_KEY || 'traingpt-mobile-strava-dev-secret';
}

function base64Url(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function sign(payload: string) {
  return createHmac('sha256', stateSecret()).update(payload).digest('base64url');
}

export async function POST(req: Request) {
  try {
    const supabase = await createRouteSupabaseClient(req);
    const user = await requireUser(supabase);

    const clientId = process.env.STRAVA_CLIENT_ID || process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json({ error: 'Strava is not configured.' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const appRedirect = typeof body?.appRedirect === 'string' && body.appRedirect.startsWith('traingpt://')
      ? body.appRedirect
      : 'traingpt://strava/callback';

    const payload = JSON.stringify({
      type: 'mobile',
      userId: user.id,
      appRedirect,
      createdAt: Date.now(),
    });

    const encoded = base64Url(payload);
    const state = `mobile.${encoded}.${sign(encoded)}`;
    const redirectUri = `${getBaseUrl(req)}/api/strava/callback`;

    const url = new URL('https://www.strava.com/oauth/authorize');
    url.searchParams.set('client_id', String(clientId));
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', 'activity:read_all,profile:read_all');
    url.searchParams.set('approval_prompt', 'auto');
    url.searchParams.set('state', state);

    return NextResponse.json({ url: url.toString(), redirectTo: appRedirect });
  } catch (error) {
    console.error('[strava/mobile-connect] failed:', error);
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Could not start Strava connection.' }, { status: 500 });
  }
}
