'use client';

import { createBrowserClient } from '@supabase/ssr';

type BrowserSupabaseClient = ReturnType<typeof createBrowserClient>;

declare global {
  // eslint-disable-next-line no-var
  var __traingptSupabaseBrowserClient: BrowserSupabaseClient | undefined;
}

function getRequiredEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function createBrowserSupabaseClient() {
  if (globalThis.__traingptSupabaseBrowserClient) {
    return globalThis.__traingptSupabaseBrowserClient;
  }

  const client = createBrowserClient(
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
    getRequiredEnv(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
  );

  if (process.env.NODE_ENV !== 'production') {
    globalThis.__traingptSupabaseBrowserClient = client;
  }

  return client;
}

export const supabase = createBrowserSupabaseClient();