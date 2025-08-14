// /app/api/backfill-sessions/route.ts

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

function extractSport(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes('swim')) return 'Swim';
  if (lower.includes('bike')) return 'Bike';
  if (lower.includes('run')) return 'Run';
  if (lower.includes('strength')) return 'Strength';
  if (lower.includes('rest')) return 'Rest';
  return 'Other';
}

export async function GET() {
  const supabase = createServerComponentClient({ cookies });

  // Step 1 — find all plans that have no matching sessions
  const { data: orphanPlans, error: orphanErr } = await supabase
    .from('plans')
    .select('id, user_id, plan')
    .not('plan', 'is', null) // must have plan JSON
    .filter('id', 'in', `(${await getOrphanPlanIds(supabase)})`);

  if (orphanErr) {
    console.error('❌ Error fetching orphan plans:', orphanErr.message);
    return NextResponse.json({ error: orphanErr.message }, { status: 500 });
  }

  let insertedCount = 0;
  let skippedCount = 0;
  const planBreakdown: any[] = [];

  for (const planRow of orphanPlans || []) {
    const { id: plan_id, user_id, plan } = planRow;

    let weeks: any[] = [];
    if (Array.isArray(plan)) {
      weeks = plan;
    } else if (plan?.days) {
      weeks = [plan];
    } else {
      continue;
    }

    let planInserted = 0;

    for (const week of weeks) {
      for (const date in week.days) {
        const sessions: string[] = week.days[date] || [];
        for (const title of sessions) {
          const sport = extractSport(title);

          const { data: existing, error: checkError } = await supabase
            .from('sessions')
            .select('id')
            .eq('user_id', user_id)
            .eq('plan_id', plan_id)
            .eq('date', date)
            .eq('sport', sport)
            .limit(1);

          if (checkError) {
            console.error(`❌ Error checking existing for ${date} - ${title}`, checkError.message);
            continue;
          }

          if (existing?.length > 0) {
            skippedCount++;
            continue;
          }

          const { error: insertError } = await supabase.from('sessions').insert({
            user_id,
            plan_id,
            date,
            title,
            sport,
            status: 'planned',
            created_at: new Date().toISOString(),
          });

          if (insertError) {
            console.error(`❌ Insert error for ${date} - ${title}:`, insertError.message);
          } else {
            insertedCount++;
            planInserted++;
          }
        }
      }
    }

    planBreakdown.push({
      plan_id,
      user_id,
      sessionsInserted: planInserted,
    });
  }

  return NextResponse.json({
    success: true,
    message: `✅ Backfill complete. Inserted ${insertedCount} sessions. Skipped ${skippedCount} duplicates.`,
    plansProcessed: planBreakdown.length,
    planBreakdown,
  });
}

async function getOrphanPlanIds(supabase: any) {
  // Query to get plan IDs with no sessions
  const { data, error } = await supabase.rpc('get_orphan_plan_ids');
  if (error) {
    console.error('❌ Error getting orphan plan IDs:', error.message);
    throw error;
  }
  return data.map((row: any) => `'${row.id}'`).join(',');
}
