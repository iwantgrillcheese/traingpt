import { NextResponse } from 'next/server';
import { differenceInWeeks } from 'date-fns';
import OpenAI from 'openai';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const runtime = 'nodejs';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  const body = await req.json();

  const planLengthWeeks = differenceInWeeks(new Date(body.raceDate), new Date());
  const useGPT4 = body.experience === 'Advanced';
  const model = useGPT4 ? 'gpt-4-turbo' : 'gpt-3.5-turbo';

  const prompt = `
You are a world-class triathlon coach building a structured, personalized training plan that ends on the athlete’s race day.

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
- The training plan must start on the Monday ${planLengthWeeks} weeks before race day.
- Each week runs Monday to Sunday.
- Race Day (${body.raceDate}) must be the **final session** of the entire plan.
- Label it exactly: “🌟 Race Day: ${body.raceType}”
- Include this final session **even if it’s not on a Sunday**. Do not omit it.

---

Additional Notes from Athlete:
${body.userNote || 'None'}

---

Plan Generation Rules:
1. Periodize clearly: base → build → peak → taper → race week
2. Each week includes:
   - label (e.g. “Week 4: Aerobic Threshold Focus”)
   - focus: 1-sentence summary
   - days: an object with 7 keys (Monday–Sunday), each listing 0–2 training sessions
3. Weekly structure:
   - Include 1 full rest day on their preferred day (or Sunday if not specified)
   - Long workouts must reflect the race distance (e.g. no 2hr runs for Sprint races)
   - Brick workouts encouraged 1× weekly after base phase

4. Pacing/Intensity Guidelines:
   - Use threshold paces or power **only if provided**
   - If missing, use general descriptions (e.g. “easy aerobic”, “moderate effort”)
   - Avoid artificial intensity numbers

5. Experience Level Guidance:
   - If Beginner: use simpler language, lower volume, fewer intervals
   - If Advanced: allow more specificity, intensity, and structured work

---

Coach Note:
Return a short paragraph as if you are a real, supportive triathlon coach. Be optimistic, practical, and conversational.
Use this style:
“Hey Cam — here’s a 12-week half ironman plan for you. It’s broken into three 4-week blocks. First we build base fitness, then we dial in volume and some speed, and finally we focus on race pace work and a proper taper. Don’t sweat if you miss a workout here or there — just stay consistent and you’ll be ready to crush race day.”

This note should:
- Greet the athlete by name if available
- Reference the training block structure
- Encourage consistency without perfection
- Feel human, not robotic
- Be warm, confident, and helpful

---

Final Output Format:
Return a single JSON object with:
- coachNote: string (a short 3–6 sentence message to the athlete)
- plan: array of week objects

Each week object must include:
- label: string
- focus: string
- days: { Monday–Sunday }: 0–2 short string sessions per day

Each session string should look like:
- “🏊 Swim: 3×400m aerobic”
- “🚴 Bike: 4×8min @ threshold”
- “🏃 Run: 40min progression run”
- “Rest day”
- “🌟 Race Day: ${body.raceType}”

⚠️ Do not skip race day. It must appear as the final entry, with that exact label.
⚠️ Only return the raw JSON object. No markdown or explanation.
`;

  const completion = await openai.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  });

  const content = completion.choices[0]?.message?.content || '{}';

  try {
    const clean = content.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    const supabase = createServerClient({ cookies });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const user_id = session?.user?.id;
    if (!user_id) {
      return NextResponse.json({ error: 'No Supabase access token found' }, { status: 401 });
    }

    await supabase.from('plans').upsert({
      user_id,
      plan: parsed.plan,
      coach_note: parsed.coachNote,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to finalize plan:', err);
    return NextResponse.json({ error: 'Failed to finalize plan.' }, { status: 500 });
  }
}
