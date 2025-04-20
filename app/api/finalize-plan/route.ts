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

Use your elite coaching expertise to design a periodized, realistic plan tailored to the athlete’s race type, experience, and available training time. Plans should build week to week and conclude with a confident taper into race day.

---

Athlete Profile:
- Race Type: ${body.raceType}
- Race Date: ${body.raceDate}
- Bike FTP: ${body.bikeFTP || 'Not provided'}
- Run Threshold Pace: ${body.runPace || 'Not provided'}
- Swim Threshold Pace: ${body.swimPace || 'Not provided'}
- Experience Level: ${body.experience}
- Max Weekly Training Hours: ${body.maxHours}
- Preferred Rest Day: ${body.restDay || 'None specified'}

Today's date is ${new Date().toISOString().split('T')[0]}.
There are ${planLengthWeeks} full calendar weeks between now and race week.

Important constraints:
- The plan must start on the most recent Monday that aligns with a clean training progression and ends on race day (${body.raceDate}).
- Race Day must be the **final session** of the plan and occur **exactly on ${body.raceDate}**.
- Each day key must be a full ISO 8601 date string: "YYYY-MM-DD".
- Label Race Day exactly like this: “🌟 Race Day: ${body.raceType}”

---

Additional Notes from Athlete:
${body.userNote || 'None'}

---

Plan Generation Rules:
1. Periodize clearly: base → build → peak → taper → race week
2. Each week includes:
   - label: (e.g. “Week 4: Aerobic Threshold Focus”)
   - focus: a short 1-sentence summary
   - days: an object where each key is an ISO date (e.g. "2025-05-12") and the value is a list of 0–2 sessions

3. Weekly structure:
   - Include 1 rest day per week on their preferred day (or Sunday if not specified)
   - Brick workouts 1x/week after base phase
   - Long workouts should scale with race type

4. Pacing/Intensity Guidelines:
   - Use threshold paces or power **only if provided**
   - Otherwise, use general effort levels like "easy", "moderate", "race pace"

5. Experience Level Guidance:
   - Beginner: simple structure, fewer intervals
   - Advanced: more specificity, intensity, and variety

---

Coach Note:
Write a warm, short note from a supportive coach. Make it sound human.
Example: “Hey Cam — here’s a 12-week Olympic plan. First few weeks are base fitness, then we layer in intensity, and finally we taper to race day. Stick with it — you’re gonna crush it.”

---

Final Output Format:
Return a single JSON object with:
- coachNote: string
- plan: array of week objects

Each week object must include:
- label: string
- focus: string
- days: { ISO_DATE: [“🏊 Swim: 3×400m aerobic”, “🏃 Run: 30min easy”] }

⚠️ Do not skip Race Day. It must appear as the final session, and must be on ${body.raceDate}.
⚠️ Only return the raw JSON object — no markdown, no extra explanation.
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
