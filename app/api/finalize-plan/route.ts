// /api/finalize-plan/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { format, addDays, addWeeks } from 'date-fns';

import { startPlan } from '@/utils/start-plan';
import { sendWelcomeEmail } from '@/lib/emails/send-welcome-email';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const runtime = 'nodejs';

type RaceType = 'Sprint' | 'Olympic' | 'Half Ironman (70.3)' | 'Ironman (140.6)';

const MIN_WEEKS: Record<RaceType, number> = {
  Sprint: 2,
  Olympic: 3,
  'Half Ironman (70.3)': 4,
  'Ironman (140.6)': 6,
};

const MAX_WEEKS: Record<RaceType, number> = {
  Sprint: 20,
  Olympic: 24,
  'Half Ironman (70.3)': 28,
  'Ironman (140.6)': 32,
};

const getNextMonday = (date: Date): Date => {
  const day = date.getDay();
  const diff = (8 - day) % 7;
  return addDays(date, diff);
};

const getPhase = (index: number, total: number): string => {
  if (index === total - 1) return 'Race Week';
  if (index === total - 2) return 'Taper';
  if (index === total - 3) return 'Peak';
  if (index >= Math.floor(total * 0.5)) return 'Build';
  return 'Base';
};

const getDeload = (index: number): boolean => (index + 1) % 4 === 0;

export async function POST(req: Request) {
  console.time('[⏱️ finalize-plan total]');
  console.log('🔥 /api/finalize-plan hit');

  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user_id = user.id;
  const user_email = user.email;

  const body = await req.json();
  const today = new Date();
  const startDate = getNextMonday(today);

  // Fetch fallback values from most recent plan if needed
  const { data: latestPlan, error: fetchError } = await supabase
    .from('plans')
    .select('*')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('❌ Error fetching latest plan:', fetchError);
    return NextResponse.json({ error: 'Failed to fetch plan.' }, { status: 500 });
  }

  const raceType = (body.raceType || latestPlan?.race_type) as RaceType;
  const raceDate = new Date(body.raceDate || latestPlan?.race_date);
  const experience = body.experience || latestPlan?.experience || 'Intermediate';
  const maxHours = body.maxHours || latestPlan?.max_hours || 8;
  const restDay = body.restDay || latestPlan?.rest_day || 'Monday';
  const userNote = body.userNote || '';

  const bikeFTP = body.bikeFTP || null;
  const runPace = body.runPace || null;
  const swimPace = body.swimPace || null;

  // Ensure raceType is valid
  if (!(raceType in MIN_WEEKS)) {
    return NextResponse.json({ error: 'Unsupported race type.' }, { status: 400 });
  }

  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const totalWeeks = Math.ceil((raceDate.getTime() - startDate.getTime()) / msPerWeek);
  const minWeeks = MIN_WEEKS[raceType];
  const maxWeeks = MAX_WEEKS[raceType];

  if (totalWeeks < minWeeks) {
    return NextResponse.json(
      { error: `Your race is too soon. Minimum required: ${minWeeks} weeks.` },
      { status: 400 }
    );
  }

  if (totalWeeks > maxWeeks) {
    return NextResponse.json(
      { error: `Race too far. Max supported: ${maxWeeks} weeks.`, code: 'TOO_MANY_WEEKS', maxWeeks },
      { status: 400 }
    );
  }

  const planMeta = Array.from({ length: totalWeeks }, (_, i) => ({
    label: `Week ${i + 1}`,
    phase: getPhase(i, totalWeeks),
    deload: getDeload(i),
    startDate: format(addWeeks(startDate, i), 'yyyy-MM-dd'),
  }));

  console.log(`🧠 Generating ${totalWeeks} weeks of training...`);
  const plan = await startPlan({
    planMeta,
    userParams: {
      raceType,
      raceDate,
      startDate,
      totalWeeks,
      experience,
      maxHours,
      restDay,
      bikeFTP,
      runPace,
      swimPace,
      userNote,
    },
  });

  const coachNote = `Here's your ${totalWeeks}-week triathlon plan leading to your race on ${format(
    raceDate,
    'yyyy-MM-dd'
  )}. Stay consistent and trust the process.`;

  const { error: saveError } = await supabase.from('plans').upsert(
    {
      user_id,
      plan,
      coach_note: coachNote,
      note: userNote,
      race_type: raceType,
      race_date: raceDate,
      experience,
      max_hours: maxHours,
      rest_day: restDay,
    },
    { onConflict: 'user_id' }
  );

  if (saveError) {
    console.error('❌ Supabase Insert Error:', saveError);
    return NextResponse.json({ error: saveError.message }, { status: 500 });
  }

  try {
    await sendWelcomeEmail({
      to: user_email ?? '',
      name: user.user_metadata?.name ?? 'Athlete',
      plan: `${raceType} — ${format(raceDate, 'MMMM d')}`,
    });
  } catch (err) {
    console.error('📪 Welcome email failed:', err);
  }

  console.timeEnd('[⏱️ finalize-plan total]');
  return NextResponse.json({ success: true, plan, coachNote });
}
