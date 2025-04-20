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
You are a world-class triathlon coach and a JSON API that returns only valid JSON.

Your task is to generate a personalized, structured triathlon training plan that ends on the athlete's race day. The plan should follow modern coaching principles: progressive overload, clear periodization, and an intelligent taper leading into the final race.

---

Athlete Profile:
- Race Type: ${body.raceType}
- Race Date: ${body.raceDate}
- Experience Level: ${body.experience}
- Bike FTP: ${body.bikeFTP || 'Not provided'}
- Run Threshold Pace: ${body.runPace || 'Not provided'}
- Swim Threshold Pace: ${body.swimPace || 'Not provided'}
- Max Weekly Training Hours: ${body.maxHours}
- Preferred Rest Day: ${body.restDay || 'None specified'}

Today's date is ${new Date().toISOString().split('T')[0]}.

---

Important Constraints:
- The plan must start on a **Monday** and end on race day: **${body.raceDate}**.
- The **final session** must occur **exactly** on race day: “🌟 Race Day: ${body.raceType}”.
- Each training week runs Monday–Sunday.
- Each day key must be an ISO 8601 date string (e.g. "2025-06-02").
- Only include valid days in the range from start to ${body.raceDate} (inclusive).

---

Plan Guidelines:
1. Periodize clearly: base → build → peak → taper → race week
2. Use progressive structure tailored to the athlete’s profile.
3. Include 1 full rest day per week (on preferred day, or Sunday if not specified).
4. Include brick workouts 1x/week after the base phase.
5. Long sessions and weekly volume should scale appropriately for the race type.
6. Use pacing/power cues **only if available**, otherwise use general effort levels like “easy”, “moderate”, or “race pace”.
7. Vary training by sport (swim, bike, run) — don’t overload any single sport.

---

Output Format:
Return a single JSON object with:
- plan: array of weeks

Each week object must include:
- label: string (e.g. "Week 3: Peak Volume")
- focus: string (short 1-sentence weekly goal)
- days: { [ISO_DATE]: string[] }

Each date maps to 0–2 session strings, like:
- "🏊 Swim: 3×400m aerobic"
- "🚴 Bike: 1hr Z2"
- "🏃 Run: 30min easy"
- "🌟 Race Day: ${body.raceType}"

⚠️ Do not omit race day. It must appear once and only once, exactly on ${body.raceDate}.
⚠️ Do not return markdown or explanation. Only return raw JSON.
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
