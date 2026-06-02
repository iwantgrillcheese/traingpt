import { randomBytes, createHmac } from 'crypto';
import { NextResponse } from 'next/server';
import { AuthError, createRouteSupabaseClient, requireUser } from '@/lib/supabase/server';
import { getBaseUrl, getOuraEnv, getOuraRedirectUri } from '@/lib/oura';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function stateSecret() {
  return process.env.OURA_STATE_SECRET || process.env.NEXTAUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.OPENAI_API_KEY || 'traingpt-oura-dev-secret';
}

function sign(payload: string) {
  return createHmac('sha256', stateSecret()).update(payload).digest('base64url');
}

function encodeState(payload: Record<string, unknown>) {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

export async function GET(req: Request) {
  try {
    const supabase = await createRouteSupabaseClient(req);
    const user = await requireUser(supabase);
    const { clientId } = getOuraEnv();
    const url = new URL(req.url);
    const returnTo = url.searchParams.get('returnTo')?.startsWith('/') ? url.searchParams.get('returnTo')! : '/settings';
    const redirectUri = getOuraRedirectUri(req);
    const nonce = randomBytes(12).toString('base64url');

    const state = encodeState({
      userId: user.id,
      returnTo,
      nonce,
      createdAt: Date.now(),
    });

    const authorizeUrl = new URL('https://cloud.ouraring.com/oauth/authorize');
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('client_id', clientId);
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);
    authorizeUrl.searchParams.set('scope', 'daily personal');
    authorizeUrl.searchParams.set('state', state);

    return NextResponse.redirect(authorizeUrl);
  } catch (error) {
    console.error('[oura/connect] failed:', error);
    const baseUrl = getBaseUrl(req);
    const fallback = new URL('/settings', baseUrl);
    fallback.searchParams.set('oura_error', error instanceof AuthError ? 'unauthorized' : error instanceof Error ? error.message : 'connect_failed');
    return NextResponse.redirect(fallback);
  }
}
