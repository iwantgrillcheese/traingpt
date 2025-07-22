// 1. fetchGPTSummary.ts — Util to fetch summary from DB or API

import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function fetchGPTSummary(userId: string) {
  const supabase = createServerComponentClient({ cookies });

  const { data, error } = await supabase
    .from('gpt_summaries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('[fetchGPTSummary] Error:', error);
    return null;
  }

  return data;
}
