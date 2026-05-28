import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { User } from '@supabase/supabase-js';

function getRequiredEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
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
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
    getRequiredEnv(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ),
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

export async function createRouteSupabaseClient() {
  return createServerSupabaseClient();
}

export async function requireUser(
  supabase?: Awaited<ReturnType<typeof createServerSupabaseClient>>
): Promise<User> {
  const client = supabase ?? (await createServerSupabaseClient());

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