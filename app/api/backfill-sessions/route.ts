// /app/api/backfill-sessions/route.ts
import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
  const supabase = createServerComponentClient({ cookies });
  const planId = req.url.split('planId=')[1];

  if (!planId) {
    return NextResponse.json({ error: 'Missing planId' }, { status: 400 });
  }

  // Fetch the plan
  const { data: planRow, error } = await supabase
    .from('plans')
    .select('plan, user_id')
    .eq('id', planId)
    .single();

  if (error || !planRow) {
    return NextResponse.json({ error: 'Failed to fetch plan' }, { status: 500 });
  }

  const { plan, user_id } = planRow;

  const sessions = [];
  for (const week of plan) {
    for (const session of week.sessions || []) {
      sessions.push({
        user_id,
        plan_id: planId,
        title: session.title,
        date: session.date,
        sport: session.sport || 'unknown',
        status: 'planned',
      });
    }
  }

  const { error: insertErr } = await supabase.from('sessions').insert(sessions);

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, inserted: sessions.length });
}
