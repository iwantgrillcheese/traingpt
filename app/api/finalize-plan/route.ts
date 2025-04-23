import { NextResponse } from 'next/server';
import { addDays, addWeeks, differenceInCalendarWeeks, format } from 'date-fns';
import OpenAI from 'openai';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9500);

  try {
    const completion = await openai.chat.completions.create(
      {
        model,
        messages: [
          { role: 'system', content: 'Reply with valid JSON only. No explanation.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
      },
      { signal: controller.signal }
    );

    clearTimeout(timeout);
    return completion.choices[0]?.message?.content || '{}';
  } catch (err) {
    clearTimeout(timeout);
    console.error('[GPT TIMEOUT OR ERROR]', err);
    throw new Error('GPT call timed out or failed.');
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  const supabase = createServerComponentClient({ cookies });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user_id = session?.user?.id;
  if (!user_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

  const plan = [];
  for (let i = 0; i < weeks.length; i++) {
    const week = weeks[i];
    const endDate = format(addDays(new Date(week.startDate), 6), 'yyyy-MM-dd');

    const prompt = `You are a world-class triathlon coach generating training for week ${i + 1} of a personalized triathlon plan.

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
- Week End: ${endDate}

User Notes:
${userNote || 'None provided'}

**IMPORTANT RULES**
- This plan ends in a race on ${format(raceDate, 'yyyy-MM-dd')}.
- The final week **must** include the race on that date.
- You must include exactly 1 full rest day (no sessions at all).
- Long Ride always on Saturday. Long Run on Sunday.
- Brick sessions are ONLY allowed on Saturdays, and must be in this format: bike ➝ run.
- Do not use reverse bricks (run ➝ bike).
- Only include bricks for long-course races (70.3 / Ironman).
- Avoid back-to-back threshold or high intensity days.
- Always stay under the ${maxHours} hour weekly cap. Trim non-essentials if needed.

Suggested Weekly Layout:
- Monday: Rest or Swim/Drill
- Tuesday: Threshold Bike
- Wednesday: Swim + Easy Bike
- Thursday: Threshold Run
- Friday: Swim or Z2 Ride
- Saturday: Long Ride + Brick Run (if applicable)
- Sunday: Long Run

Use this output format exactly:
{
  label: "Week ${i + 1}: ${week.phase}",
  focus: "<Summary of weekly focus>",
  days: {
    "YYYY-MM-DD": ["🏊 Swim: ...", "🏃 Run: ..."],
    ...
  }
}`;

    const content = await safeGPTCall(prompt);

    let parsed;
    try {
      parsed = JSON.parse(content.match(/\{[\s\S]*\}/)?.[0] || '{}');
    } catch (err) {
      console.error('❌ Failed to parse GPT content', content);
      return NextResponse.json({ error: 'Failed to parse plan content' }, { status: 500 });
    }

    if (!parsed?.days || typeof parsed.days !== 'object') {
      console.error('❌ Parsed plan missing days object:', parsed);
      return NextResponse.json({ error: 'Malformed training plan' }, { status: 500 });
    }

    plan.push(parsed);
  }

  const coachNote = `Here's your ${totalWeeks}-week triathlon plan leading to your race on ${body.raceDate}. ${adjusted ? 'We adjusted the duration for optimal training.' : ''} Each week balances aerobic work, race specificity, and recovery. Stay consistent and trust the process.`;

  await supabase.from('plans').upsert({
    user_id,
    plan,
    coach_note: coachNote,
  });

  return NextResponse.json({
    success: true,
    plan,
    coachNote,
    adjusted,
  });
}
