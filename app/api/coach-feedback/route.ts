import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      messages = [],
      upcomingSessions = [],
      userNote = '',
      raceType = 'Olympic',
      raceDate = '',
      experienceLevel = 'Intermediate',
    } = body;

    const chatHistory = messages
      .map((msg: any) => `${msg.role === 'user' ? 'Athlete' : 'Coach'}: ${msg.content}`)
      .join('\n');

    const systemPrompt = `
You are a world-class triathlon coach known for helping athletes train with confidence and clarity. You specialize in giving clear, actionable advice when athletes ask questions during their training journey.

This athlete is following a custom, phase-aware triathlon training plan. Your job is to respond like a coach who knows them well and respects their training journey.

# 🎯 Mission

Answer the athlete's question directly, using the athlete’s profile and their upcoming training sessions for context. You are not summarizing a week or assigning new workouts. You’re giving smart, supportive, real-time coaching advice.

# 🧠 Coaching Principles

- Be practical: Give clear advice, not vague encouragement.
- Be empathetic: If they’re nervous or unsure, reassure them.
- Be specific: Tie in upcoming sessions if helpful.
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
- Upcoming sessions:
${upcomingSessions.length > 0 ? upcomingSessions.map((s: string) => `  - ${s}`).join('\n') : '  - None scheduled'}

Recent Conversation:
${chatHistory}

Latest Question:
"${userNote}"
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
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
