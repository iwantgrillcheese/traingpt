// /app/api/backfill-sessions/route.ts

import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import convertPlanToSessions from '@/utils/convertPlanToSessions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const supabase = createServerComponentClient({ cookies });

  const { searchParams } = new URL(req.url);
  const onlyNoSessions = searchParams.get('onlyNoSessions') === '1';

  // 1️⃣ Get all users with plans (optionally filter to those with no sessions)
  let query = supabase
    .from('plans')
    .select('id, user_id, plan');

  if (onlyNoSessions) {
    query = query.in(
      'user_id',
      // find users with plan but no sessions
      (
        await supabase
          .rpc('users_with_plan_but_no_sessions') // or manual query if no RPC
      ).data
    );
  }

  const { data: plans, error } = await query;

  if (error) {
    return NextResponse.json({ success: false, message: error.message });
  }

  let insertedCount = 0;
  let errorsSample: { msg: string }[] = [];

  for (const planRow of plans || []) {
    if (!planRow.plan) continue;

    const sessions = convertPlanToSessions(planRow.plan, planRow.user_id);

    if (!sessions.length) continue;

    const batch = sessions.map((s) => ({
      user_id: s.user_id,
      date: s.date,
      title: s.title,
      sport: s.sport,
      status: s.status || 'planned',
      created_at: new Date().toISOString(),
    }));

    const { error: insErr } = await supabase
      .from('sessions')
      .insert(batch, { count: 'exact' }); // ✅ no .select() here

    if (insErr) {
      if (errorsSample.length < 5) errorsSample.push({ msg: insErr.message });
    } else {
      insertedCount += batch.length;
    }
  }

  return NextResponse.json({
    success: true,
    message: `✅ Backfill complete. Inserted ${insertedCount} sessions.`,
    errorsSample,
  });
}
