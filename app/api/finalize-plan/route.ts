// /api/finalize-plan/route.ts (cleaned + fixed JSON parse)
import { NextResponse } from 'next/server';
import { addDays, addWeeks, format } from 'date-fns';
import OpenAI from 'openai';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { COACH_SYSTEM_PROMPT } from '@/lib/coachPrompt';
import { buildCoachPrompt } from '@/utils/buildCoachPrompt';
import { sendWelcomeEmail } from '@/lib/emails/send-welcome-email';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const runtime = 'nodejs';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MIN_WEEKS = {
  Sprint: 2,
  Olympic: 3,
  'Half Ironman (70.3)': 4,
  'Ironman (140.6)': 6,
};

const MAX_WEEKS = {
  Sprint: 20,
  Olympic: 24,
  'Half Ironman (70.3)': 28,
  'Ironman (140.6)': 32,
};

function getNextMonday(date: Date) {
  const day = date.getDay();
  const diff = (8 - day) % 7;
  return addDays(date, diff);
}

function getPhase(index: number, totalWeeks: number): string {
  if (index === totalWeeks - 1) return 'Race Week';
  if (index === totalWeeks - 2) return 'Taper';
  if (index === totalWeeks - 3) return 'Peak';
  if (index >= Math.floor(totalWeeks * 0.5)) return 'Build';
  return 'Base';
}

function getDeload(index: number): boolean {
  return (index + 1) % 4 === 0;
}

export async function POST(req: Request) {
  console.time('[⏱️ TOTAL]');
  const body = await req.json();
  const userNote = body.userNote || '';

  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user_id = user.id;
  const user_email = user.email;
  const today = new Date();
  const startDate = getNextMonday(today);

  const { data: latestPlan, error: fetchError } = await supabase
    .from('plans')
    .select('*')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('❌ Fetch error:', fetchError);
    return NextResponse.json({ error: 'Unexpected Supabase error' }, { status: 500 });
  }

  const raceType = body.raceType || latestPlan?.race_type;
  const raceDate = new Date(body.raceDate || latestPlan?.race_date);
  const experience = body.experience || latestPlan?.experience || 'Intermediate';
  const maxHours = body.maxHours || latestPlan?.max_hours || 8;
  const restDay = body.restDay || latestPlan?.rest_day || 'Monday';

  let totalWeeks = Math.ceil((raceDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
  const minWeeks = MIN_WEEKS[raceType as keyof typeof MIN_WEEKS] || 6;
  const maxWeeks = MAX_WEEKS[raceType as keyof typeof MAX_WEEKS] || 20;
  let adjusted = false;

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

  const weekMeta = Array.from({ length: totalWeeks }, (_, i) => ({
    label: `Week ${i + 1}`,
    phase: getPhase(i, totalWeeks),
    deload: getDeload(i),
    startDate: format(addWeeks(startDate, i), 'yyyy-MM-dd'),
  }));

  const prompt = buildCoachPrompt({
    raceType,
    raceDate,
    startDate,
    totalWeeks,
    experience,
    maxHours,
    restDay,
    bikeFTP: 'Not provided',
    runPace: 'Not provided',
    swimPace: 'Not provided',
    userNote,
    weekMeta,
  });

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    messages: [
      { role: 'system', content: COACH_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
  });

  const rawContent = response.choices[0]?.message?.content;

  let parsed: any[] = [];
  try {
    parsed = JSON.parse(rawContent || '');
  } catch (e) {
    console.error('❌ Failed to parse GPT response as JSON:', rawContent);
    return NextResponse.json({ error: 'GPT output was not valid JSON' }, { status: 500 });
  }

  if (!parsed || !Array.isArray(parsed)) {
    console.error('❌ Invalid plan format:', parsed);
    return NextResponse.json({ error: 'Invalid plan structure from GPT' }, { status: 500 });
  }

  for (const week of parsed) {
    if (
      typeof week.label !== 'string' ||
      typeof week.phase !== 'string' ||
      typeof week.startDate !== 'string' ||
      typeof week.deload !== 'boolean' ||
      typeof week.days !== 'object' ||
      Array.isArray(week.days)
    ) {
      console.error('❌ Invalid week format:', week);
      return NextResponse.json({ error: 'Invalid week format in plan' }, { status: 500 });
    }
  }

  const coachNote = `Here's your ${totalWeeks}-week triathlon plan leading to your race on ${format(
    raceDate,
    'yyyy-MM-dd'
  )}. ${adjusted ? 'We adjusted the duration for optimal training.' : ''} Stay consistent and trust the process.`;

  const { error: saveError } = await supabase.from('plans').upsert(
    {
      user_id,
      plan: parsed,
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

  console.timeEnd('[⏱️ TOTAL]');
  return NextResponse.json({ success: true, plan: parsed, coachNote, adjusted });
}
