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

async function safeGPTCall(prompt: string, model = 'gpt-4-turbo') {
  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'Reply with valid JSON only. No explanation.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
    });
    return completion.choices[0]?.message?.content || '{}';
  } catch (err) {
    console.error('[GPT TIMEOUT OR ERROR]', err);
    throw new Error('GPT call timed out or failed.');
  }
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
  const today = new Date();
  const startDate = getNextMonday(today);
  const raceDate = new Date(body.raceDate);
  const experience = body.experience || 'Intermediate';
  const raceType = body.raceType || 'Olympic';
  const maxHours = body.maxHours || 8;
  const restDay = body.restDay || 'Monday';
  const bikeFTP = body.bikeFTP || 'Not provided';
  const runPace = body.runPace || 'Not provided';
  const swimPace = body.swimPace || 'Not provided';
  const userNote = body.userNote || '';

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

  const weeks = Array.from({ length: totalWeeks }, (_, i) => {
    const start = addWeeks(startDate, i);
    return {
      label: `Week ${i + 1}`,
      phase: getPhase(i, totalWeeks),
      deload: getDeload(i),
      startDate: format(start, 'yyyy-MM-dd'),
    };
  });

  const plan = await Promise.all(
    weeks.map(async (week, i) => {
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
      });

      const content = await safeGPTCall(prompt);

      try {
        const parsed = JSON.parse(content.match(/\{[\s\S]*\}/)?.[0] || '{}');
        if (!parsed?.days || typeof parsed.days !== 'object') {
          console.error('❌ Parsed plan missing days object:', parsed);
          throw new Error('Malformed training plan');
        }
        return parsed;
      } catch (err) {
        console.error('❌ Failed to parse GPT content', content);
        throw new Error('Failed to parse plan content');
      }
    })
  );

  const coachNote = `Here's your ${totalWeeks}-week triathlon plan leading to your race on ${format(
    raceDate,
    'yyyy-MM-dd'
  )}. ${adjusted ? 'We adjusted the duration for optimal training.' : ''} Each week balances aerobic work, race specificity, and recovery. Stay consistent and trust the process.`;

  console.log('📦 Saving plan to Supabase', { user_id, planLength: plan.length });

  const { data, error } = await supabase.from('plans').upsert(
    {
      user_id,
      plan,
      coach_note: coachNote,
      note: userNote,
      race_type: raceType,
      race_date: raceDate,
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    console.error('❌ Supabase Insert Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    console.log('✅ Successfully saved to Supabase:', data);
  }

  return NextResponse.json({
    success: true,
    plan,
    coachNote,
    adjusted,
  });
}
