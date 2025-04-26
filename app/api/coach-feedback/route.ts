import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      messages = [],
      completedSessions = [],
      userNote = '',
      raceType = 'Olympic',
      raceDate = '',
      experienceLevel = 'Intermediate',
    } = body;

    if (!userNote.trim()) {
      return NextResponse.json({ error: 'User note is required.' }, { status: 400 });
    }

    const systemPrompt = `
You are a world-class triathlon coach known for helping athletes train with confidence and clarity. You specialize in giving clear, actionable advice when athletes ask questions during their training journey.

This athlete is following a custom, phase-aware triathlon training plan. Your job is to respond like a coach who knows them well and respects their training journey.

# 🎯 Mission

Answer the athlete's question directly, using the athlete’s profile and today’s planned session for context. You are not summarizing a week or assigning new workouts. You’re giving smart, supportive, real-time coaching advice.

# 🧠 Coaching Principles

- Be practical: Give clear advice, not vague encouragement.
- Be empathetic: If they’re nervous or unsure, reassure them.
- Be specific: Tie in today’s session if helpful.
- Be concise: No long essays. No fluff.
- Be human: Write like a coach texting their athlete, not a formal report.

Avoid:
- Repeating the question back
- Giving generic theory
- Being overly robotic or formal
`;

    const userPrompt = `
Athlete Profile:
- Race type: ${raceType}
- Race date: ${raceDate || 'Not provided'}
- Experience level: ${experienceLevel}
- Today's planned training: ${completedSessions.length > 0 ? completedSessions.map((s: string) => `  - ${s}`).join('\n') : 'Rest day'}

Athlete’s Question:
"${userNote}"
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
        ...messages.slice(-8), // Only include last 8 convo turns to save tokens
      ],
      temperature: 0.7,
      max_tokens: 600,
    });

    const feedback = completion.choices[0]?.message?.content?.trim() || '';

    return NextResponse.json({ feedback });
  } catch (err: any) {
    console.error('[COACH_FEEDBACK_ERROR]', err);
    return NextResponse.json({ error: 'Failed to generate feedback.' }, { status: 500 });
  }
}
