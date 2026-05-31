import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { User } from '@supabase/supabase-js';

function getRequiredEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function supabaseUrl() {
  return getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
}

function supabaseAnonKey() {
  return getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function getBearerToken(req?: Request) {
  const header = req?.headers.get('authorization') ?? req?.headers.get('Authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export class AuthError extends Error {
  status = 401;

  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'AuthError';
  }
}

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    supabaseUrl(),
    supabaseAnonKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components cannot always write cookies.
            // Route handlers and middleware can.
          }
        },
      },
    }
  );
}

export async function createRouteSupabaseClient(req?: Request) {
  const bearerToken = getBearerToken(req);

  if (bearerToken) {
    return createClient(supabaseUrl(), supabaseAnonKey(), {
      global: {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return createServerSupabaseClient();
}

export async function requireUser(
  supabase?: Awaited<ReturnType<typeof createRouteSupabaseClient>>
): Promise<User> {
  const client = supabase ?? (await createRouteSupabaseClient());

  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    throw new AuthError();
  }

  return user;
}

export function assertSameUser({
  authenticatedUserId,
  requestedUserId,
  routeName,
}: {
  authenticatedUserId: string;
  requestedUserId?: string | null;
  routeName: string;
}) {
  if (!requestedUserId) return;

  if (authenticatedUserId !== requestedUserId) {
    console.error(`[${routeName}] user mismatch`, {
      authenticatedUserId,
      requestedUserId,
    });

    throw new AuthError('Session mismatch. Please sign out and sign back in.');
  }
}
