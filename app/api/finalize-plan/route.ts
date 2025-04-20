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
You are a JSON API that returns only valid JSON. You are also a world-class triathlon coach who specializes in Half Ironman (70.3), Ironman (140.6), and Olympic-distance training.

Your job is to generate a **complete training plan** that starts on the most recent Monday and ends **exactly on race day** (${body.raceDate}). The plan must reflect expert-level periodization and realistic endurance coaching principles.

---

Athlete Profile:
- Race Type: ${body.raceType}
- Race Date: ${body.raceDate}
- Bike FTP: ${body.bikeFTP || 'Not provided'}
- Run Threshold Pace: ${body.runPace || 'Not provided'}
- Swim Threshold Pace: ${body.swimPace || 'Not provided'}
- Experience Level: ${body.experience}
- Max Weekly Training Hours: ${body.maxHours}
- Preferred Rest Day: ${body.restDay || 'Sunday'}
- Today's Date: ${new Date().toISOString().split('T')[0]}

---

Training Plan Rules:
1. **Start on a Monday**, end on ${body.raceDate}, which must be the final session: 🌟 Race Day: ${body.raceType}
2. Build from **base → build → peak → taper → race week**
3. **Taper must begin exactly 7 days before race day**. Maintain intensity, reduce volume. Avoid early taper.
4. Include 1 full rest day per week (on athlete’s preferred day)
5. Include 1 brick per week after base phase
6. Sessions must be realistic — no 2hr runs for Sprint, no 45min bike for Ironman, etc.
7. Weekly focus and structure should reflect real-world coaching logic, not random volume stacking
8. Optional testing: include 1–2 threshold test sessions early in the plan if appropriate
9. Use pacing/power targets if provided, otherwise use terms like “easy aerobic,” “moderate,” or “race pace”

---

Output Format:
Return a JSON object:
{
  "plan": [
    {
      "label": "Week 1: Base Endurance",
      "focus": "Build foundational aerobic fitness and perform light testing",
      "days": {
        "2025-04-21": ["🏊 Swim: 1500m aerobic", "🏃 Run: 30min Z2"],
        ...
        "2025-04-27": ["Rest day"]
      }
    },
    ...
  ]
}

- Each key in “days” must be a valid ISO 8601 date (YYYY-MM-DD)
- Each value is a list of up to 2 session strings
- Final session must be “🌟 Race Day: ${body.raceType}” on ${body.raceDate}
- Do not include markdown, comments, or explanation
- Return only the raw JSON
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
