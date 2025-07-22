// /app/api/weekly-summary/route.ts
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const { data } = await supabase
    .from('weekly_summaries')
    .select('summary_text')
    .eq('user_id', user.id)
    .order('week_start_date', { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({ summary: data?.summary_text || '' });
}
