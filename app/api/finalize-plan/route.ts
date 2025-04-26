// /api/finalize-plan/route.ts (patched to support reroll or fresh plan generation)
import { NextResponse } from 'next/server';
import { addDays, addWeeks, differenceInCalendarWeeks, format } from 'date-fns';
import OpenAI from 'openai';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { COACH_SYSTEM_PROMPT } from '@/lib/coachPrompt';
import { buildCoachPrompt } from '@/utils/buildCoachPrompt';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const runtime = 'nodejs';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MIN_WEEKS: Record<string, number> = {
  Sprint: 4,
  Olympic: 6,
  'Half Ironman (70.3)': 10,
  'Ironman (140.6)': 12,
};

const MAX_WEEKS: Record<string, number> = {
  Sprint: 16,
  Olympic: 20,
  'Half Ironman (70.3)': 24,
  'Ironman (140.6)': 30,
};

function getNextMonday(date: Date) {
  const day = date.getDay();
  const diff = (8 - day) % 7;
  return addDays(date, diff);
}

function getPhase(index: number, totalWeeks: number): string {
  if (index === totalWeeks - 1) return 'Race Week';
  if (index >= totalWeeks - 2) return 'Taper';
  if (index >= Math.floor(totalWeeks * 0.6)) return 'Build';
  return 'Base';
}

function getDeload(index: number): boolean {
  return (index + 1) % 4 === 0;
}

export async function POST(req: Request) {
  const body = await req.json();
  const userNote = body.userNote || '';

  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user_id = user.id;
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
    console.error('❌ Failed to fetch existing plan metadata:', fetchError);
    return NextResponse.json({ error: 'Unexpected Supabase error' }, { status: 500 });
  }

  const raceType = latestPlan?.race_type || body.raceType;
  const raceDate = new Date(latestPlan?.race_date || body.raceDate);
  const experienceLevel = latestPlan?.experience || body.experience || 'Intermediate';
  const maxHours = latestPlan?.max_hours || body.maxHours || 8;
  const restDay = latestPlan?.rest_day || body.restDay || 'Monday';

  let totalWeeks = differenceInCalendarWeeks(raceDate, startDate);
  const minWeeks = MIN_WEEKS[raceType] || 6;
  const maxWeeks = MAX_WEEKS[raceType] || 20;
  let adjusted = false;

  if (totalWeeks < minWeeks) {
    totalWeeks = minWeeks;
    adjusted = true;
  }
  if (totalWeeks > maxWeeks) {
    totalWeeks = maxWeeks;
    adjusted = true;
  }

  const weekMeta = Array.from({ length: totalWeeks }, (_, i) => {
    const start = addWeeks(startDate, i);
    return {
      label: `Week ${i + 1}`,
      phase: getPhase(i, totalWeeks),
      deload: getDeload(i),
      startDate: format(start, 'yyyy-MM-dd'),
    };
  });

  const prompt = buildCoachPrompt({
    raceType,
    raceDate,
    startDate,
    totalWeeks,
    experience: experienceLevel,
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

  const content = response.choices[0]?.message?.content || '{}';

  try {
    const cleaned = content.replace(/```json|```/g, '').trim();
    const plan = JSON.parse(cleaned);

    const coachNote = `Here's your ${totalWeeks}-week triathlon plan leading to your race on ${format(
      raceDate,
      'yyyy-MM-dd'
    )}. ${adjusted ? 'We adjusted the duration for optimal training.' : ''} Each week balances aerobic work, race specificity, and recovery. Stay consistent and trust the process.`;

    const { data, error } = await supabase.from('plans').upsert(
      {
        user_id,
        plan,
        coach_note: coachNote,
        note: userNote,
        race_type: raceType,
        race_date: raceDate,
        experience: experienceLevel,
        max_hours: maxHours,
        rest_day: restDay,
      },
      { onConflict: 'user_id' }
    );

    if (error) {
      console.error('❌ Supabase Insert Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, plan, coachNote, adjusted });
  } catch (err) {
    console.error('❌ Failed to parse GPT content', content);
    return NextResponse.json({ error: 'Failed to parse plan content' }, { status: 500 });
  }
}
