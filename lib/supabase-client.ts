'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type SupabaseBrowserClient = ReturnType<typeof createClientComponentClient>;

declare global {
  // eslint-disable-next-line no-var
  var __supabaseBrowserClient: SupabaseBrowserClient | undefined;
}

export const supabase: SupabaseBrowserClient =
  globalThis.__supabaseBrowserClient ?? createClientComponentClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__supabaseBrowserClient = supabase;
}
