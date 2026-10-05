import { NextResponse, type NextRequest } from 'next/server';
import { updateSupabaseSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  // Redirect before analytics/auth initialization. Preserve campaign parameters.
  // Existing www sessions use host-scoped Supabase cookies. Keep those sessions
  // and in-flight PKCE callbacks on www; new anonymous requests use the apex.
  const legacySession = request.cookies?.getAll().some(cookie => /^sb-.*-auth-token(?:\.\d+)?$/.test(cookie.name));
  if (request.nextUrl.hostname === 'www.traingpt.co' && !legacySession && !request.nextUrl.pathname.startsWith('/auth/')) {
    const canonical = request.nextUrl.clone();
    canonical.hostname = 'traingpt.co';
    return NextResponse.redirect(canonical, 308);
  }
  return updateSupabaseSession(request);
}

export const config = {
  matcher: [
    /*
     * Run middleware on app routes, but skip static assets.
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
