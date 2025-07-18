// /app/api/backfill-sessions/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const supabase = createServerComponentClient({ cookies });

  const { data: plans, error } = await supabase
    .from('plans')
    .select('id, user_id, plan')
    .neq('plan', null);

  if (error) {
    console.error('❌ Error fetching plans:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let insertedCount = 0;

  for (const planRow of plans) {
    const { id: plan_id, user_id, plan } = planRow;

    for (const week of plan) {
      for (const date in week.days) {
        const sessions = week.days[date];
        for (const label of sessions) {
          const { error: insertError } = await supabase.from('sessions').insert({
            user_id,
            plan_id,
            date,
            label,
            status: 'planned',
          });

          if (insertError) {
            console.error(`❌ Insert error for ${label} on ${date}:`, insertError.message);
          } else {
            insertedCount++;
          }
        }
      }
    }
  }

  return NextResponse.json({
    success: true,
    inserted: insertedCount,
  });
}
