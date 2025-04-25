import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { completedSessions = [], userNote = '', raceType = 'Olympic', experienceLevel = 'Intermediate' } = body;

    if (!Array.isArray(completedSessions)) {
      console.warn('[INVALID_INPUT] completedSessions is not an array:', completedSessions);
      return NextResponse.json({ error: 'Invalid input: completedSessions must be an array.' }, { status: 400 });
    }

    const hasUserQuestion = userNote.trim().length > 0;

    const prompt = hasUserQuestion
      ? `
You are a world-class triathlon coach.

Here are some recent sessions from the athlete:
${completedSessions.map((s) => `- ${s}`).join('\n')}

The athlete asked you:
"${userNote}"

Respond like a real coach. Give specific, honest advice. Be concise and practical.
`
      : `
You are a world-class triathlon coach.

Here are some recent sessions from the athlete:
${completedSessions.map((s) => `- ${s}`).join('\n')}

The athlete is training for a ${raceType} triathlon and is ${experienceLevel}-level.

Write a short weekly check-in, as if you're their coach reviewing their progress. Mention highlights, any concerns, and next steps.
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    const feedback = completion.choices[0]?.message?.content || '';
    return NextResponse.json({ feedback });
  } catch (err: any) {
    console.error('[COACH_FEEDBACK_ERROR]', err);
    return NextResponse.json({ error: 'Failed to generate feedback.' }, { status: 500 });
  }
}
