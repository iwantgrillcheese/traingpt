import { NextResponse } from 'next/server';
import { addDays, addWeeks, differenceInCalendarWeeks, format } from 'date-fns';
import OpenAI from 'openai';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { format } from 'date-fns';

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
  const { data: { user } } = await supabase.auth.getUser();

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
      const prompt = `You are a world-class triathlon coach generating week-level training.

Athlete Profile:
- Race Type: ${raceType}
- Experience: ${experience}
- Max Weekly Hours: ${maxHours}
- Preferred Rest Day: ${restDay}
- Bike FTP: ${bikeFTP}
- Run Threshold Pace: ${runPace}
- Swim Threshold Pace: ${swimPace}
- Phase: ${week.phase}
- Deload Week: ${week.deload ? 'Yes' : 'No'}
- Week Start: ${week.startDate}

Athlete Note:
${userNote || 'None provided'}
Incorporate this into your planning where appropriate.

This athlete has a hard weekly time cap of ${maxHours} hours.
Stay under this limit. Prioritize:
- Long ride (Saturday)
- Long run (Sunday)
- 1 brick (Saturday only)
- 1 threshold session
- 1–2 swims

Skip strength or extras if time is tight.

Rest Day Rules:
- Each week must include exactly one full rest day
- Default to Monday unless another day is specified
- Never replace a rest day with any other session, including swimming

Brick Guidelines:
- Include 1 brick session per week, only on Saturday
- Brick = bike followed by short run
- Sprint: 10–15min run
- Olympic: 20–30min run
- 70.3 / Ironman: 30–45min run

Suggested Weekday Structure:
- Monday: Rest or Swim/Drill
- Tuesday: Threshold Bike
- Wednesday: Swim + Easy Bike
- Thursday: Threshold Run
- Friday: Swim or Z2 Ride
- Saturday: Long Ride + Brick Run
- Sunday: Long Run

Avoid back-to-back threshold days.
Session duration should reflect phase and race type:
- Base = shorter, consistent sessions
- Build = higher intensity and longer bricks
- Respect user input on max time available

Avoid reverse bricks (run → bike). Only use bike → run format.

Return this format ONLY:
{
  label: "Week ${i + 1}: ${week.phase}",
  focus: "...",
  days: {
    "YYYY-MM-DD": ["🏃 Run: ...", "🚴 Bike: ..."],
    ...
  }
}`;

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

  const coachNote = `Here's your ${totalWeeks}-week triathlon plan leading to your race on ${format(raceDate, 'yyyy-MM-dd')}. ${adjusted ? 'We adjusted the duration for optimal training.' : ''} Each week balances aerobic work, race specificity, and recovery. Stay consistent and trust the process.`;

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
