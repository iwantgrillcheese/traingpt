// File: /app/api/generate-detailed-session/route.ts

import { NextResponse } from 'next/server';
import { openai } from '@/lib/openai';

export async function POST(req: Request) {
  try {
    const { title, date } = await req.json();

    if (!title || !date) {
      return NextResponse.json({ error: 'Missing session title or date.' }, { status: 400 });
    }

    const prompt = `
You are a world-class triathlon coach.
Write a detailed, structured workout for the following session:

"${title}" on ${date}.

Include:
- Warmup
- Main set(s)
- Cooldown
- Specific distances, paces, or zones
- Technique or form notes (if relevant)

The output should be clear, concise, and formatted with bullet points or short sections. No extra fluff.
    `;

    const gptResponse = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    const content = gptResponse.choices[0].message?.content;

    return NextResponse.json({ response: content });
  } catch (error) {
    console.error('Detailed session error:', error);
    return NextResponse.json({ error: 'Failed to generate workout.' }, { status: 500 });
  }
}
