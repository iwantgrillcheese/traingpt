// /app/api/backfill-sessions/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

function extractSport(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('swim')) return 'Swim';
  if (lower.includes('bike')) return 'Bike';
  if (lower.includes('run')) return 'Run';
  if (lower.includes('strength')) return 'Strength';
  if (lower.includes('rest')) return 'Rest';
  return 'Other';
}

export async function GET() {
  const supabase = createServerComponentClient({ cookies });

  // 1. Find all plans that have no sessions
  const { data: plans, error: planError } = await supabase
    .from('plans')
    .select('id, user_id, plan')
    .order('user_id', { ascending: true });

  if (planError) {
    console.error('❌ Error fetching plans:', planError);
    return NextResponse.json({ error: planError.message }, { status: 500 });
  }

  let insertedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const debugLog: any[] = [];

  for (const planRow of plans) {
    const { id: plan_id, user_id, plan } = planRow;

    if (!plan?.days && !Array.isArray(plan)) {
      debugLog.push({ user_id, plan_id, reason: 'No valid plan data' });
      continue;
    }

    const weeks = Array.isArray(plan) ? plan : [plan];

    for (const week of weeks) {
      if (!week.days) continue;
      for (const date in week.days) {
        const sessions: string[] = week.days[date];
        for (const title of sessions) {
          const sport = extractSport(title);

          // Check if already exists
          const { data: existing, error: checkError } = await supabase
            .from('sessions')
            .select('id')
            .eq('user_id', user_id)
            .eq('plan_id', plan_id)
            .eq('date', date)
            .eq('sport', sport)
            .limit(1);

          if (checkError) {
            debugLog.push({ user_id, date, title, error: checkError.message });
            failedCount++;
            continue;
          }

          if (existing?.length > 0) {
            skippedCount++;
            continue;
          }

          // Insert without "source"
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
            debugLog.push({ user_id, date, title, error: insertError.message });
            failedCount++;
          } else {
            insertedCount++;
          }
        }
      }
    }
  }

  return NextResponse.json({
    success: true,
    message: `✅ Backfill complete. Inserted ${insertedCount} sessions. Skipped ${skippedCount} duplicates. Failed ${failedCount} inserts.`,
    debug: debugLog.slice(0, 50), // limit debug output
  });
}
