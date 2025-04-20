import { NextResponse } from 'next/server';
import { differenceInWeeks } from 'date-fns';
import OpenAI from 'openai';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const runtime = 'nodejs';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

  const planLengthWeeks = differenceInWeeks(new Date(body.raceDate), new Date());
  const useGPT4 = body.experience === 'Advanced';
  const model = useGPT4 ? 'gpt-4-turbo' : 'gpt-3.5-turbo';

  const prompt = `
You are a JSON API that replies with valid JSON only. You are a world-class triathlon coach building a structured, personalized training plan that ends on the athlete’s race day.

Use your elite coaching expertise to design a realistic, periodized plan tailored to the athlete’s goals, experience level, and available training hours.

---

Athlete Profile:
- Race Type: ${body.raceType}
- Race Date: ${body.raceDate}
- Experience Level: ${body.experience}
- Max Weekly Hours: ${body.maxHours}
- Bike FTP: ${body.bikeFTP || 'Not provided'}
- Run Threshold Pace: ${body.runPace || 'Not provided'}
- Swim Threshold Pace: ${body.swimPace || 'Not provided'}
- Preferred Rest Day: ${body.restDay || 'None specified'}

Athlete Notes:
${body.userNote || 'None provided'}

Today’s date is ${new Date().toISOString().split('T')[0]}.

---

Rest Day Rules:
- Each week must include **exactly one** full rest day.
- Use the athlete’s preferred rest day if provided: ${body.restDay || 'None specified'}.
- Do not assign Sunday as a rest day unless no preference is provided.
- Never include multiple full rest days in a week.

---

Plan Structure:
- Periodize the plan using common training blocks:
  - Base Phase: focus on aerobic capacity and durability
  - Build Phase: include race-specific intensity and brick workouts
  - Taper Phase: reduce volume, maintain intensity, prepare for race
  - Race Week: final sharpening, rest, and race day

- Include for each week:
  - label: “Week 3: Threshold Build” or similar
  - focus: short sentence summarizing the training emphasis
  - days: an object where each key is a date (YYYY-MM-DD) and value is 0–2 sessions

- Sessions should look like:
  - “🏃 Run: 45min Z2”
  - “🚴 Bike: 3×8min @ FTP”
  - “🏊 Swim: 2000m aerobic”
  - “🌟 Race Day: ${body.raceType}” (must appear exactly once)

---

Pacing/Intensity Guidance:
- Use threshold paces or FTP **only if provided**
- Otherwise use general effort: “easy”, “Z2”, “moderate”, “race pace”
- Include brick workouts 1x/week in build and taper phases

---

Final Output Format:
Return a single JSON object:
{
  coachNote: string,
  plan: array of week objects
}

Each week object must include:
- label
- focus
- days: { ISO_DATE: [“🏃 Run: 30min easy”, “🚴 Bike: 1hr endurance”] }

⚠️ Race Day must appear exactly once and must be the final entry on the correct date: ${body.raceDate}
⚠️ Only return valid JSON — no markdown, no explanation, no headings.
`;

  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are a JSON API that replies with valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content || '{}';
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('❌ No valid JSON object found in AI response.');
    }

    const parsed = JSON.parse(match[0]);

    await supabase.from('plans').upsert({
      user_id,
      plan: parsed.plan,
      coach_note: parsed.coachNote,
    });

    return NextResponse.json({
      success: true,
      plan: parsed.plan,
      coachNote: parsed.coachNote,
    });
  } catch (err) {
    console.error('❌ Finalize Plan Error:', err);
    return NextResponse.json({ error: 'Failed to finalize plan.' }, { status: 500 });
  }
}
