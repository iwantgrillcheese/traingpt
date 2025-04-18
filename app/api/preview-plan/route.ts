import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  const body = await req.json();

  const useGPT4 = body.experience === 'Advanced';
  const model = useGPT4 ? 'gpt-4-turbo' : 'gpt-3.5-turbo';

  const prompt = `You are a world-class triathlon coach creating a 5-day sample training block based on the following athlete's profile:

Athlete Profile:
- Race Type: ${body.raceType}
- Race Date: ${body.raceDate}
- Bike FTP: ${body.bikeFTP} watts
- Run Threshold Pace: ${body.runPace} per mile
- Swim Threshold Pace: ${body.swimPace} per 100m
- Experience Level: ${body.experience}
- Max Weekly Training Hours: ${body.maxHours}
- Preferred Rest Day: ${body.restDay}

Additional Notes from Athlete:
${body.userNote || 'None'}

Key Guidelines:
- Design 5 consecutive days of training (e.g. Monday to Friday or Tuesday to Saturday)
- Each day must include a maximum of 2 sessions — ideally 1 for most days
- All sessions should reflect the athlete’s level and realistic intensities based on threshold pace and FTP
- Use formats like endurance, tempo, brick, swim drills, open water, etc.
- Avoid overly intense or race-specific sessions if not appropriate
- Be practical: a human coach should be able to use this to impress a potential coaching client

Output format:
Return a JSON object with 5 keys (e.g., Monday–Friday).
Each key maps to an array of up to 2 session strings.

Example:
{
  "Monday": ["🏊 Swim: 1500m drills @ 1:45/100m"],
  "Tuesday": ["🚴 Bike: 60min endurance @ 190w", "🏃 Run: 30min brick run @ 8:15/mi"],
  "Wednesday": ["Rest day"],
  "Thursday": [...],
  "Friday": [...]
}

Return only the JSON object. No explanations.`;

  const completion = await openai.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  });

  const content = completion.choices[0]?.message?.content || '{}';

try {
  const clean = content.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean);
  return NextResponse.json(parsed);
} catch (err) {
  console.error('Failed to parse preview plan:', err);
  return NextResponse.json({ error: 'Failed to parse preview plan.' }, { status: 500 });
}
}