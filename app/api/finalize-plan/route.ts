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
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user_id = user.id;
  let {
    raceType,
    raceDate,
    experience,
    maxHours,
    restDay,
    bikeFTP,
    runPace,
    swimPace,
    userNote,
    startDate,
    totalWeeks,
  } = body;

  // If reroll with just userNote, pull last saved plan
  if (!raceType || !raceDate) {
    const { data: lastPlan, error } = await supabase
      .from('plans')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !lastPlan) {
      return NextResponse.json({ error: 'No existing plan to reroll' }, { status: 400 });
    }

    raceType = lastPlan.race_type;
    raceDate = lastPlan.race_date;
    restDay = lastPlan.rest_day || 'Monday';
    bikeFTP = lastPlan.bike_ftp || 'Not provided';
    runPace = lastPlan.run_pace || 'Not provided';
    swimPace = lastPlan.swim_pace || 'Not provided';
    experience = lastPlan.experience || 'Intermediate';
    maxHours = lastPlan.max_hours || 8;
    startDate = getNextMonday(new Date());
    totalWeeks = differenceInCalendarWeeks(new Date(raceDate), startDate);
  }

  raceDate = new Date(raceDate);
  startDate = startDate ? new Date(startDate) : getNextMonday(new Date());
  totalWeeks = totalWeeks || differenceInCalendarWeeks(raceDate, startDate);

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

  const weekMeta: {
    label: string;
    phase: string;
    deload: boolean;
    startDate: string;
  }[] = Array.from({ length: totalWeeks }, (_, i) => {
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
    experience,
    maxHours,
    restDay,
    bikeFTP,
    runPace,
    swimPace,
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
        rest_day: restDay,
        bike_ftp: bikeFTP,
        run_pace: runPace,
        swim_pace: swimPace,
        experience,
        max_hours: maxHours,
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
