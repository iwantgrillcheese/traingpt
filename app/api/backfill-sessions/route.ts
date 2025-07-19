// /app/api/backfill-sessions/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const supabase = createServerComponentClient({ cookies });

  // Get all non-null plans
  const { data: plans, error } = await supabase
    .from('plans')
    .select('id, user_id, plan')
    .neq('plan', null);

  if (error) {
    console.error('❌ Error fetching plans:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let insertedCount = 0;

  for (const planRow of plans) {
    const { id: plan_id, user_id, plan } = planRow;

    // Delete old sessions for this user first
    await supabase.from('sessions').delete().eq('user_id', user_id);

    // Loop over each week
    for (const week of plan) {
      for (const date in week.days) {
        const sessions: string[] = week.days[date];

        for (const label of sessions) {
          const sport = label.toLowerCase().includes('swim')
            ? 'Swim'
            : label.toLowerCase().includes('bike')
            ? 'Bike'
            : label.toLowerCase().includes('run')
            ? 'Run'
            : label.toLowerCase().includes('strength')
            ? 'Strength'
            : label.toLowerCase().includes('rest')
            ? 'Rest'
            : 'Other';

          const { error: insertError } = await supabase.from('sessions').insert({
            user_id,
            plan_id,
            date,
            label,
            sport,
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
    message: `Inserted ${insertedCount} sessions.`,
  });
}
