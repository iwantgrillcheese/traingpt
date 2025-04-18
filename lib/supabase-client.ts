// app/utils/supabaseClient.ts
'use client';

import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs';
import { useState } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';

export default function useSupabase() {
  const [supabase] = useState(() => createBrowserSupabaseClient());
  return supabase;
}
