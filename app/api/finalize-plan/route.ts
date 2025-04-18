import OpenAI from 'openai';
import { OpenAIStream, StreamingTextResponse } from 'ai';
import { differenceInWeeks } from 'date-fns';

export const config = {
  runtime: 'edge',
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  const body = await req.json();

  const planLengthWeeks = differenceInWeeks(new Date(body.raceDate), new Date());
  const useGPT4 = body.experience === 'Advanced';
  const model = useGPT4 ? 'gpt-4-turbo' : 'gpt-3.5-turbo';

  const prompt = `You are a world-class triathlon coach creating a peak performance training plan that ends on the athlete's race date.

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
The training plan should span ${planLengthWeeks} full weeks, with the final session on race day (${body.raceDate}). The first week should start on the Monday that is ${planLengthWeeks} weeks before race day..

Additional Notes from Athlete:
${body.userNote || 'None'}

Core Rules:
- Periodize into base, build, peak, taper, and race week.
- Each week must include:
  - A label (e.g. "Week 3: Threshold Development")
  - A one-sentence focus (e.g. "Sharpen bike power and improve tempo run durability.")
- End the plan on race day with a "🌟 Race Day: ${body.raceType}" session.
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

  const response = await openai.chat.completions.create({
    model,
    stream: true,
    messages: [{ role: 'user', content: prompt }],
  });

  const stream = OpenAIStream(response);
  return new StreamingTextResponse(stream);
}
