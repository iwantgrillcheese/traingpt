import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

// ------------------------
// Only backfill these plan IDs (from CSV)
// ------------------------
const missingPlanIds = [
  "3c82a2ce-a0f8-4123-a70c-d9b07310d4a0",
  "91113a98-24f5-4d8b-91fa-bb229891c77b",
  "839df08e-a115-440a-8636-3353a19eadb8",
  "82a0b419-f76c-45fb-9080-83b27a899c38",
  "124dd09a-fb30-48b8-a6b1-11c516b065d9",
  "c0063bd8-e46a-4a5f-8c4f-23e66de81c9d",
  "65e2164d-9797-4207-989f-e6fec0e42416",
  "f60ca25b-df33-4afc-962e-733944bca232",
  "07946c6d-b759-4f3c-a38a-b64e35eab238",
  "59228e0c-e4f1-43a8-8053-bf8fe6dff17f",
  "45eb6653-86a6-43b1-bffd-92faab36790e",
  "c471b8c7-395c-4427-826e-2eea06b637cf",
  "8d93d4d2-156b-4904-bf23-1a93baeb263e",
  "9e883ba3-427b-44c5-91ba-2a001c022478",
  "0f0c8034-3407-4e3a-a46c-13fcdcc80501",
  "62ac78fa-e573-43e9-84e6-55f586fad972",
  "f159d526-7dde-4ed4-8787-33d6d68967ed",
  "bab179d7-6f15-4e32-a9d0-5c79c142aac1",
  "4027eb26-3769-4f11-853c-1c7fee23786b",
  "62193674-19ce-437d-b3c7-d4f550736bf6",
  "38d4756c-b5bd-4f51-8540-674e83668616",
  "68e665d6-fc68-42b8-a443-bf02aba2295d",
  "b327a66e-1b57-4b4e-8ef7-08fb7be5f23d",
  "551355ff-c0a3-4115-a80a-3dadefc72a0a"
];

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
    .in('id', missingPlanIds);

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
      weeks = [plan]; // legacy 1-week shape
    } else {
      continue;
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
