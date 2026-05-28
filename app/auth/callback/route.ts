import { NextResponse } from 'next/server';
import { createRouteSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function resolveNextPath(raw: string | null) {
  if (!raw || !raw.startsWith('/')) return '/plan';
  return raw;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = resolveNextPath(url.searchParams.get('next'));

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', url.origin));
  }

  const supabase = await createRouteSupabaseClient();

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('[auth/callback] code exchange failed:', error);
    return NextResponse.redirect(new URL('/login?error=oauth_exchange_failed', url.origin));
  }

  return NextResponse.redirect(new URL(next, url.origin));
}