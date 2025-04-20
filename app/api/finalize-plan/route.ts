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
You are a JSON API that returns only valid JSON. You are also a world-class triathlon coach.

Your job is to create a structured training plan that starts on the most recent Monday and ends on the athlete's race day. The plan should follow expert principles of endurance training and periodization.

---

Athlete Info:
- Race Type: ${body.raceType}
- Race Date: ${body.raceDate}
- Bike FTP: ${body.bikeFTP || 'Not provided'}
- Run Threshold Pace: ${body.runPace || 'Not provided'}
- Swim Threshold Pace: ${body.swimPace || 'Not provided'}
- Experience: ${body.experience}
- Max Weekly Hours: ${body.maxHours}
- Preferred Rest Day: ${body.restDay || 'Sunday'}
- Today's Date: ${new Date().toISOString().split('T')[0]}

---

Instructions:
1. The plan must end exactly on race day: ${body.raceDate}. Race day must be the **last session**.
2. Start on the most recent Monday before today.
3. Each week should:
   - Have a clear label (e.g. "Week 4: Build Volume")
   - Include a short focus summary
   - Contain a "days" object with 7 keys (ISO 8601 dates), each mapping to an array of 0–2 short session strings
   - Each session should look like: "🏃 Run: 40min Z2" or "🚴 Bike: 3×8min @ FTP"
4. Use pacing or power targets only if provided.
5. Taper should begin **2 weeks before race day**. No sooner. Keep intensity but reduce volume.
6. Include 1 full rest day per week on the athlete's preferred day.
7. Include at least 1 brick session per week after the base phase.
8. Long workouts should scale based on the race type (e.g., 3hr bikes for Half Ironman).

---

Return JSON in this format:
{
  "plan": [
    {
      "label": "Week 1: Base Endurance",
      "focus": "Build foundational aerobic fitness",
      "days": {
        "2025-04-14": ["Rest day"],
        "2025-04-15": ["🏊 Swim: 1500m easy", "🏃 Run: 30min Z2"],
        ...
      }
    },
    ...
  ]
}

- Do not include markdown or explanation.
- Return only valid JSON.
- Race Day must appear as the final session, with this exact label:
  "🌟 Race Day: ${body.raceType}"
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
