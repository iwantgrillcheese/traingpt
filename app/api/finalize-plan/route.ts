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
You are a JSON API that replies with valid JSON only. You are a world-class triathlon coach creating a structured training plan that ends on race day (${body.raceDate}).

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
There are ${planLengthWeeks} full training weeks before race week.

---

📌 Absolute Rules:
- The training plan **must end on race day: ${body.raceDate}**
- Race Day must be the **final session** of the final week, labeled: “🌟 Race Day: ${body.raceType}”
- Race week must start on the **Monday before ${body.raceDate}** and include ${body.raceDate} itself.
- Each week object should include:
  - label (e.g. "Week 6: Taper & Race Week")
  - focus (short 1-sentence summary)
  - days: a map of ISO dates (YYYY-MM-DD) to 0–2 session strings

---

💡 Formatting Instructions:
Return a **single JSON object** like this:
{
  coachNote: string,
  plan: [
    {
      label: string,
      focus: string,
      days: {
        "2025-04-14": ["🏊 Swim: 3×400m aerobic"],
        "2025-04-15": ["🚴 Bike: 60min Z2", "🏃 Run: 20min off bike"],
        ...
        "2025-05-31": ["🌟 Race Day: Olympic"]
      }
    },
    ...
  ]
}

---

📚 Plan Guidelines:
1. Periodization: base → build → peak → taper → race week
2. Include 1 rest day per week (use preferred rest day if given)
3. Brick sessions: 1x/week after base phase
4. Use provided pacing data (FTP / threshold pace) only if given
5. Respect race type — don’t overbuild (e.g., no 2hr runs for Sprint)
6. Vary focus and session types week to week
7. Keep weekday sessions shorter than weekends unless noted

---

📣 Coach Note:
Write a short, warm message as if you're a real triathlon coach. Reference the overall structure and motivate the athlete.
Example: "Hey Cam — here’s your 6-week plan leading into your Olympic race. We'll start with aerobic base, build up volume and race-specific efforts, then taper into race day. Let’s go crush it."

---

⚠️ Warnings:
- Race Day (${body.raceDate}) must appear as the final session
- Do not return markdown, only raw JSON
- Do not include explanation or surrounding text — only the final JSON object
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
