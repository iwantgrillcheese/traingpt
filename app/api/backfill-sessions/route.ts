import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: Request) {
  const supabase = createServerComponentClient({ cookies });

const user = { id: '6f26bc3d-6fc1-4f06-a622-e089310d44b0' }; // replace with correct user_id from plans table

  const url = new URL(req.url);
  const planId = url.searchParams.get('planId');
  if (!planId) return NextResponse.json({ error: 'Missing planId' }, { status: 400 });

  const { data: plan, error } = await supabase
    .from('plans')
    .select('*')
    .eq('id', planId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error || !plan) {
    console.error('[❌ FETCH ERROR]', error);
    return NextResponse.json({ error: 'Failed to fetch plan' }, { status: 404 });
  }

  const sessions = plan.plan.flatMap((week: any) =>
    week.days.map((day: any) => ({
      id: uuidv4(),
      user_id: user.id,
      plan_id: plan.id,
      date: day.date,
      sport: day.sport,
      label: day.title,
      status: 'planned',
      structured_workout: null,
      created_at: new Date().toISOString(),
    }))
  );

  const { error: insertError } = await supabase.from('sessions').insert(sessions);

  if (insertError) {
    console.error('[❌ INSERT ERROR]', insertError);
    return NextResponse.json({ error: 'Failed to insert sessions' }, { status: 500 });
  }

  return NextResponse.json({ status: 'ok', inserted: sessions.length });
}
