import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  const body = await req.json();
  const { completedSessions, userNote, raceType, experienceLevel } = body;

  // Check if user asked a question
  const hasUserQuestion = userNote && userNote.trim().length > 0;

  const prompt = hasUserQuestion
    ? `
You are a world-class triathlon coach.

Here are some recent sessions from the athlete:
${completedSessions.map((s: string) => `- ${s}`).join('\n')}

The athlete asked you:
"${userNote}"

Respond like a real coach. Give specific, honest advice. You don’t need to explain basic terms — the athlete is experienced. Be helpful, concise, and write like a person who actually coaches athletes. Include key takeaways or adjustments if needed.
`
    : `
You are a world-class triathlon coach.

Here are some recent sessions from the athlete:
${completedSessions.map((s: string) => `- ${s}`).join('\n')}

The athlete is training for a ${raceType} triathlon and is ${experienceLevel}-level.

Write a short weekly check-in, as if you're their coach reviewing their progress. Mention anything they did well, anything they should watch out for, and advice for the next week. Use a warm, encouraging, and realistic tone. Keep it focused and clear.
`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    const feedback = completion.choices[0]?.message?.content || '';

    return NextResponse.json({ feedback });
  } catch (err) {
    console.error('Error generating coach feedback:', err);
    return NextResponse.json({ error: 'Failed to generate feedback.' }, { status: 500 });
  }
}
