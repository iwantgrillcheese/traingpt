import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { differenceInWeeks } from 'date-fns';

export const runtime = 'edge';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: Request) {
  const body = await req.json();

  // 👇 Ensure the race week is included by rounding up
  const planLengthWeeks = differenceInWeeks(
    new Date(body.raceDate),
    new Date()
  ) + 1;

  const useGPT4 = body.experience === 'Advanced';
  const model = useGPT4 ? 'gpt-4-turbo' : 'gpt-3.5-turbo';

  const prompt = `🛑 ABSOLUTELY REQUIRED: The final week must end with "🌟 Race Day: ${body.raceType}" on ${body.raceDate}. This week is mandatory and counts as the last week in the plan. Never skip or shift it.

You are a world-class triathlon coach creating a peak performance training plan that ends exactly on the athlete's race date (${body.raceDate}).

Use your elite triathlon coaching experience to build a complete, periodized training plan tailored to the athlete's profile. The plan must include clear week-level guidance and practical daily sessions.

Athlete Profile:
- Race Type: ${body.raceType}
- Race Date: ${body.raceDate}
- Bike FTP: ${body.bikeFTP} watts
- Run Threshold Pace: ${body.runPace} per mile
- Swim Threshold Pace: ${body.swimPace} per 100m
- Experience Level: ${body.experience}
- Max Weekly Training Hours: ${body.maxHours}
- Preferred Rest Day: ${body.restDay}

Today's date is ${new Date().toISOString().split('T')[0]}.
Count backward from ${body.raceDate} to create ${planLengthWeeks} weeks of training. 
The final week must taper and prepare the athlete to peak, ending with "🌟 Race Day: ${body.raceType}" on ${body.raceDate}.

Additional Notes from Athlete:
${body.userNote || 'None'}

Core Rules:
- Periodize into base, build, peak, taper, and a final race week.
- Each week must include:
  - A label (e.g. "Week 3: Threshold Development")
  - A one-sentence focus (e.g. "Sharpen bike power and improve tempo run durability.")
- End the final week with a "🌟 Race Day: ${body.raceType}" session on ${body.raceDate}.
- Include 1 full rest day weekly (on athlete's preferred day).
- Use the athlete’s threshold pace and power zones to set intensity (no made-up numbers).
- Sessions should vary: aerobic endurance, tempo, threshold, brick workouts, drills, open water, etc.
- Each day has no more than 2 sessions, realistically scheduled.
- Sessions and race plan should be specific to the distance of the race selected. (i.e. no 90 min long runs on a sprint plan)
- Total weekly training volume should reflect the race type — shorter races require lower overall volume and less weekly load.
- The training plan is the most important part of the output. Spend the majority of effort and detail on it.

In addition to the training plan, return a short message from the coach (3–6 sentences) as a "coachNote".

This message should:
- Greet the athlete (use their first name if you know it)
- Summarize how the plan is structured
- Acknowledge anything unusual (e.g., short ramp, aggressive goal)
- Offer encouragement or a disclaimer
- Be helpful, realistic, and confident — like a real coach

Final Output Format:
Return a single JSON object with two keys:

- coachNote: string — a short message from the coach
- plan: array — a full training plan, where each item is a week

Each week object in "plan" must include:
- label: string (e.g. "Week 4: Threshold Block")
- focus: string (summary of the week)
- days: object with 7 keys (Monday–Sunday), each mapping to 0–2 short strings like:
  - "🏊 Swim: 1500m aerobic @ 1:45/100m"
  - "🚴 Bike: 3×10min @ 240w (Z4), 5min recovery"
  - "🏃 Run: 45min progression run"
  - "Rest day"
  - "🌟 Race Day: ${body.raceType}"

Only return the raw JSON object. Do not include markdown or extra commentary.`;

  try {
    const completion = await openai.chat.completions.create({
      model,
      stream: true,
      temperature: 0.7,
      messages: [{ role: 'user', content: prompt }],
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of completion) {
          const content = chunk.choices?.[0]?.delta?.content;
          if (content) {
            controller.enqueue(encoder.encode(content));
          }
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch (err) {
    console.error('Streaming error:', err);
    return NextResponse.json({ error: 'Failed to generate plan.' }, { status: 500 });
  }
}
