import { createHmac, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AuthError, createRouteSupabaseClient, requireUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getBaseUrl(req: Request): string { const reqUrl = new URL(req.url); const proto = req.headers.get('x-forwarded-proto') ?? reqUrl.protocol.replace(':', ''); const host = req.headers.get('x-forwarded-host') ?? reqUrl.host; return host ? `${proto}://${host}` : process.env.NEXT_PUBLIC_BASE_URL?.trim() || reqUrl.origin; }
function resolveReturnTo(raw: string | null): string { if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/coaching'; return raw; }
function stateSecret() { return process.env.STRAVA_STATE_SECRET || process.env.NEXTAUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.OPENAI_API_KEY || 'traingpt-mobile-strava-dev-secret'; }
function sign(payload: string) { return createHmac('sha256', stateSecret()).update(payload).digest('base64url'); }
type MobileState = { type: 'mobile'; userId: string; appRedirect: string; createdAt: number; };
function parseMobileState(raw: string | null): MobileState | null { if (!raw?.startsWith('mobile.')) return null; const [, encoded, signature] = raw.split('.'); if (!encoded || !signature) return null; const left = Buffer.from(signature); const right = Buffer.from(sign(encoded)); if (left.length !== right.length || !timingSafeEqual(left, right)) return null; const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as MobileState; if (parsed.type !== 'mobile' || !parsed.userId || !parsed.appRedirect?.startsWith('traingpt://')) return null; const age = Date.now() - Number(parsed.createdAt ?? 0); return age >= 0 && age <= 1200000 ? parsed : null; }
function redirectWithParams({ baseUrl, returnTo, params }: { baseUrl: string; returnTo: string; params: Record<string, string>; }) { const url = new URL(returnTo, baseUrl); Object.entries(params).forEach(([k,v]) => { if (!url.searchParams.has(k)) url.searchParams.set(k,v); }); return NextResponse.redirect(url); }
function redirectToApp(appRedirect: string, params: Record<string, string>) { const url = new URL(appRedirect); Object.entries(params).forEach(([k,v]) => url.searchParams.set(k,v)); return NextResponse.redirect(url); }
function createServiceSupabaseClient() { const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!url || !key) throw new Error('supabase_service_role_missing'); return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }); }
async function exchangeStravaToken(code: string) { if (!process.env.STRAVA_CLIENT_ID || !process.env.STRAVA_CLIENT_SECRET) throw new Error('strava_server_config'); const res = await fetch('https://www.strava.com/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: process.env.STRAVA_CLIENT_ID, client_secret: process.env.STRAVA_CLIENT_SECRET, code, grant_type: 'authorization_code' }) }); const data = await res.json(); if (!res.ok) throw new Error('strava_token_failed'); return data; }

export async function GET(req: Request) {
  const url = new URL(req.url); const code = url.searchParams.get('code'); const rawState = url.searchParams.get('state'); const mobileState = parseMobileState(rawState); const requestedReturnTo = resolveReturnTo(rawState ?? url.searchParams.get('returnTo')); const baseUrl = getBaseUrl(req);
  if (!code) return mobileState ? redirectToApp(mobileState.appRedirect, { error: 'missing_code' }) : redirectWithParams({ baseUrl, returnTo: requestedReturnTo, params: { error: 'missing_code' } });
  try {
    const tokenData = await exchangeStravaToken(code); const { access_token, refresh_token, expires_at, athlete } = tokenData; if (!access_token || !refresh_token) throw new Error('strava_token_missing');
    if (mobileState) { const supabase = createServiceSupabaseClient(); const { error } = await supabase.from('profiles').update({ strava_access_token: access_token, strava_refresh_token: refresh_token, strava_expires_at: expires_at, strava_athlete_id: athlete?.id ?? null }).eq('id', mobileState.userId); if (error) return redirectToApp(mobileState.appRedirect, { error: 'strava_profile_update_failed' }); return redirectToApp(mobileState.appRedirect, { success: 'strava_connected', sync: 'needed' }); }
    const supabase = await createRouteSupabaseClient(); const user = await requireUser(supabase); const { error } = await supabase.from('profiles').update({ strava_access_token: access_token, strava_refresh_token: refresh_token, strava_expires_at: expires_at, strava_athlete_id: athlete?.id ?? null }).eq('id', user.id); if (error) return redirectWithParams({ baseUrl, returnTo: requestedReturnTo, params: { error: 'strava_profile_update_failed' } });
    // A new web connection is a product moment, not a plumbing step. Route plan-builder connects through the reveal; other settings reconnects keep their requested destination.
    const returnTo = requestedReturnTo.startsWith('/plan') ? '/strava-reveal' : requestedReturnTo;
    return redirectWithParams({ baseUrl, returnTo, params: { success: 'strava_connected' } });
  } catch (error) { const message = error instanceof Error ? error.message : 'unexpected_error'; console.error('[strava/callback] failed:', error); if (mobileState) return redirectToApp(mobileState.appRedirect, { error: message }); if (error instanceof AuthError) return redirectWithParams({ baseUrl, returnTo: requestedReturnTo, params: { error: 'no_user_session' } }); return redirectWithParams({ baseUrl, returnTo: requestedReturnTo, params: { error: message } }); }
}
