import type { SupabaseClient } from '@supabase/supabase-js';

export const OURA_PROVIDER = 'oura' as const;

export type OuraTokenResponse = {
  token_type?: string;
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
};

export type OuraConnection = {
  user_id: string;
  provider: typeof OURA_PROVIDER;
  provider_user_id: string | null;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  scope: string | null;
  connected_at?: string | null;
  last_synced_at?: string | null;
  raw_profile?: any;
};

export function getOuraEnv() {
  const clientId = process.env.OURA_CLIENT_ID || process.env.NEXT_PUBLIC_OURA_CLIENT_ID;
  const clientSecret = process.env.OURA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Oura is not configured. Add OURA_CLIENT_ID and OURA_CLIENT_SECRET.');
  }

  return { clientId, clientSecret };
}

export function getBaseUrl(req: Request): string {
  const reqUrl = new URL(req.url);
  const forwardedProto = req.headers.get('x-forwarded-proto') ?? reqUrl.protocol.replace(':', '');
  const forwardedHost = req.headers.get('x-forwarded-host') ?? reqUrl.host;
  return forwardedHost ? `${forwardedProto}://${forwardedHost}` : process.env.NEXT_PUBLIC_BASE_URL?.trim() || reqUrl.origin;
}

export function getOuraRedirectUri(req: Request) {
  return `${getBaseUrl(req)}/api/oura/callback`;
}

export function tokenExpiresAt(expiresInSeconds?: number) {
  if (!expiresInSeconds) return null;
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}

export async function exchangeOuraCode({
  code,
  redirectUri,
}: {
  code: string;
  redirectUri: string;
}) {
  const { clientId, clientSecret } = getOuraEnv();
  const body = new URLSearchParams();
  body.set('grant_type', 'authorization_code');
  body.set('code', code);
  body.set('redirect_uri', redirectUri);
  body.set('client_id', clientId);
  body.set('client_secret', clientSecret);

  const response = await fetch('https://api.ouraring.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('[oura] token exchange failed:', payload);
    throw new Error(payload?.error_description || payload?.error || 'Oura token exchange failed.');
  }

  return payload as OuraTokenResponse;
}

export async function refreshOuraToken(refreshToken: string) {
  const { clientId, clientSecret } = getOuraEnv();
  const body = new URLSearchParams();
  body.set('grant_type', 'refresh_token');
  body.set('refresh_token', refreshToken);
  body.set('client_id', clientId);
  body.set('client_secret', clientSecret);

  const response = await fetch('https://api.ouraring.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('[oura] token refresh failed:', payload);
    throw new Error(payload?.error_description || payload?.error || 'Oura token refresh failed.');
  }

  return payload as OuraTokenResponse;
}

export async function getValidOuraConnection(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('wearable_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', OURA_PROVIDER)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const connection = data as OuraConnection;
  const expiresAt = connection.expires_at ? new Date(connection.expires_at).getTime() : 0;
  const shouldRefresh = Boolean(connection.refresh_token && expiresAt && expiresAt < Date.now() + 5 * 60 * 1000);

  if (!shouldRefresh) return connection;

  const nextToken = await refreshOuraToken(connection.refresh_token!);
  const nextConnection = {
    ...connection,
    access_token: nextToken.access_token,
    refresh_token: nextToken.refresh_token ?? connection.refresh_token,
    expires_at: tokenExpiresAt(nextToken.expires_in),
    scope: nextToken.scope ?? connection.scope,
  };

  const { error: updateError } = await supabase
    .from('wearable_connections')
    .update({
      access_token: nextConnection.access_token,
      refresh_token: nextConnection.refresh_token,
      expires_at: nextConnection.expires_at,
      scope: nextConnection.scope,
    })
    .eq('user_id', userId)
    .eq('provider', OURA_PROVIDER);

  if (updateError) throw updateError;
  return nextConnection;
}

export async function fetchOura<T>(connection: OuraConnection, path: string) {
  const response = await fetch(`https://api.ouraring.com${path}`, {
    headers: { Authorization: `Bearer ${connection.access_token}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error(`[oura] fetch failed ${path}:`, payload);
    throw new Error(payload?.detail || payload?.error || `Oura request failed: ${path}`);
  }
  return payload as T;
}

export function ymd(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function dateDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return ymd(date);
}

export function pickReadinessScore(day: any) {
  const contributors = day?.contributors ?? {};
  return (
    day?.score ??
    day?.readiness_score ??
    contributors?.score ??
    null
  );
}
