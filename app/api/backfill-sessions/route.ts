  import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
  import { cookies } from 'next/headers';
  import { NextResponse } from 'next/server';

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

  const { data: plans, error } = await supabase
    .from('plans')
    .select('id, user_id, plan')
    .neq('plan', null);

  if (error) {
    console.error('❌ Error fetching plans:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let insertedCount = 0;
  let skippedCount = 0;

  for (const planRow of plans) {
    const { id: plan_id, user_id, plan } = planRow;

    let weeks = [];

    if (Array.isArray(plan)) {
      weeks = plan;
    } else if (plan?.days) {
      weeks = [plan]; // legacy shape
    } else {
      continue; // malformed
    }

    for (const week of weeks) {
      for (const date in week.days) {
        const sessions: string[] = week.days[date];

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
            console.error('❌ Error checking for existing session:', checkError.message);
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
            console.error(`❌ Insert error for ${title} on ${date}:`, insertError.message);
          } else {
            insertedCount++;
          }
        }
      }
    }
  }

  return NextResponse.json({
    success: true,
    message: `✅ Backfill complete. Inserted ${insertedCount} sessions. Skipped ${skippedCount} duplicates.`,
  });
}
