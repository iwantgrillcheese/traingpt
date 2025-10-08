'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// ✅ Cookie-aware, single Supabase client shared across app
export const supabase = createClientComponentClient();
