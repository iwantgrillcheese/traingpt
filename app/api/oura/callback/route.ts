import { createHmac, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { createRouteSupabaseClient } from '@/lib/supabase/server';
import { exchangeOuraCode, fetchOura, getBaseUrl, getOuraRedirectUri, OURA_PROVIDER, tokenExpiresAt } from '@/lib/oura';

type OuraPersonalInfo = {
  id?: string;
  email?: string;
  age?: number;
  biological_sex?: string;
  weight?: number;
  height?: number;
};

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function stateSecret() {
  return process.env.OURA_STATE_SECRET || process.env.NEXTAUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.OPENAI_API_KEY || 'traingpt-oura-dev-secret';
}

function sign(payload: string) {
  return createHmac('sha256', stateSecret()).update(payload).digest('base64url');
}

function parseState(raw: string | null) {
  if (!raw) return null;
  const [encoded, signature] = raw.split('.');
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;

  const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as {
    userId?: string;
    returnTo?: string;
    createdAt?: number;
  };

  if (!parsed.userId) return null;
  const ageMs = Date.now() - Number(parsed.createdAt ?? 0);
  if (ageMs < 0 || ageMs > 1000 * 60 * 20) return null;

  return {
    userId: parsed.userId,
    returnTo: parsed.returnTo?.startsWith('/') ? parsed.returnTo : '/settings',
  };
}

function redirectWithStatus(req: Request, returnTo: string, params: Record<string, string>) {
  const redirectUrl = new URL(returnTo, getBaseUrl(req));
  for (const [key, value] of Object.entries(params)) redirectUrl.searchParams.set(key, value);
  return NextResponse.redirect(redirectUrl);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = parseState(url.searchParams.get('state'));

  if (!state) {
    return redirectWithStatus(req, '/settings', { oura_error: 'invalid_state' });
  }

  if (!code) {
    return redirectWithStatus(req, state.returnTo, { oura_error: 'missing_code' });
  }

  try {
    const supabase = await createRouteSupabaseClient(req);
    const token = await exchangeOuraCode({ code, redirectUri: getOuraRedirectUri(req) });
    const expiresAt = tokenExpiresAt(token.expires_in);
    const personal = await fetchOura<OuraPersonalInfo>({
      user_id: state.userId,
      provider: OURA_PROVIDER,
      provider_user_id: null,
      access_token: token.access_token,
      refresh_token: token.refresh_token ?? null,
      expires_at: expiresAt,
      scope: token.scope ?? null,
    }, '/v2/usercollection/personal_info');

    const providerUserId = personal?.id ? String(personal.id) : personal?.email ?? null;

    const { error } = await supabase.from('wearable_connections').upsert(
      {
        user_id: state.userId,
        provider: OURA_PROVIDER,
        provider_user_id: providerUserId,
        access_token: token.access_token,
        refresh_token: token.refresh_token ?? null,
        expires_at: expiresAt,
        scope: token.scope ?? null,
        connected_at: new Date().toISOString(),
        raw_profile: personal ?? null,
      },
      { onConflict: 'user_id,provider' }
    );

    if (error) throw error;

    return redirectWithStatus(req, state.returnTo, { oura_success: 'connected', oura_sync: 'needed' });
  } catch (error) {
    console.error('[oura/callback] failed:', error);
    return redirectWithStatus(req, state.returnTo, { oura_error: error instanceof Error ? error.message : 'callback_failed' });
  }
}
