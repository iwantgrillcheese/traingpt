import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { differenceInCalendarDays, parseISO } from 'date-fns';

export const runtime = 'nodejs';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function calculatePhase(raceDateStr: string): string {
  if (!raceDateStr) return 'Base';
  try {
    const raceDate = parseISO(raceDateStr);
    const today = new Date();
    const daysUntilRace = differenceInCalendarDays(raceDate, today);

    if (daysUntilRace <= 7) return 'Race Week';
    if (daysUntilRace <= 21) return 'Taper';
    if (daysUntilRace <= 84) return 'Build'; // ~12 weeks
    return 'Base';
  } catch (error) {
    return 'Base';
  }
}

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

    const chatHistoryFormatted = messages
      .slice(-5) // Only keep the last few exchanges
      .map((msg: any) => `${msg.role === 'user' ? 'Athlete' : 'Coach'}: ${msg.content}`)
      .join('\n');

    const upcomingFormatted = upcomingSessions.length
      ? upcomingSessions.map((s: string) => `- ${s}`).join('\n')
      : '- None scheduled';

    const phase = calculatePhase(raceDate);

    const systemPrompt = `
You are a world-class triathlon coach specializing in real-time athlete support.

Your job is to act like a private, human coach texting their athlete — giving intelligent, phase-aware advice based on the athlete's profile, race timeline, training phases, recent sessions, and previous questions.

You are not a chatbot. You are not a generic advice generator. You are their personal endurance coach.

# 🧠 Coaching Principles
- Be practical: Give direct advice.
- Be phase-aware: Recognize if they are in Base, Build, Taper, or Race Week.
- Be empathetic: Encourage where appropriate without being fake.
- Be smart: Reference upcoming workouts if relevant.
- Be brief but thoughtful: Text-message tone, not email essays.

Avoid:
- Repeating the question back
- Giving academic definitions
- Acting like a template generator
- Being overly robotic or verbose
`;

    const userPrompt = `
Athlete Profile:
- Race Type: ${raceType}
- Race Date: ${raceDate || 'Not provided'}
- Current Phase: ${phase}
- Experience Level: ${experienceLevel}

Upcoming Sessions:
${upcomingFormatted}

Recent Conversation:
${chatHistoryFormatted}

Latest Question:
"${userNote}"
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        { role: 'system', content: systemPrompt.trim() },
        { role: 'user', content: userPrompt.trim() },
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
