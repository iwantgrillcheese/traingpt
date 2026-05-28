import { NextResponse } from 'next/server';
import { AuthError, createRouteSupabaseClient, requireUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createRouteSupabaseClient();
    const user = await requireUser(supabase);

    const { data, error } = await supabase
      .from('weekly_summaries')
      .select('summary_text')
      .eq('user_id', user.id)
      .order('week_start_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[weekly-summary-text] lookup failed:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ summary: data?.summary_text || '' });
  } catch (error) {
    console.error('[weekly-summary-text] failed:', error);

    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: 'Failed to load weekly summary text.' }, { status: 500 });
  }
}
