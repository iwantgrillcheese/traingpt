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
You are a world-class triathlon coach specializing in real-time, personalized support for endurance athletes.

Your mission is to coach like a trusted mentor: someone who knows the athlete’s race, phase, and goals — and gives sharp, actionable advice when they reach out with questions or concerns.

--- 

# 🎯 Core Directives
- **Coach, don't lecture:** Keep answers practical, not theoretical.
- **Connect to training:** Tie advice into upcoming sessions if helpful.
- **Coach with heart:** Be supportive when the athlete is unsure or struggling.
- **Be brief but thoughtful:** Avoid unnecessary jargon, but deliver real coaching.
- **Respect phase and race date:** Frame advice based on where they are in their journey.

---

# 📋 Athlete Context
- Race Type: ${raceType}
- Race Date: ${raceDate || 'Not provided'}
- Experience Level: ${experienceLevel}
- Upcoming Sessions:
${upcomingSessions.length > 0 ? upcomingSessions.map((s: string) => `  - ${s}`).join('\n') : '  - None scheduled'}

Recent Conversation History:
${chatHistory}

Athlete’s Latest Question:
"${userNote}"

---

# ⚡ Style Guide
- Write like a human coach texting an athlete.
- Skip formalities — dive straight into helping them.
- Suggest small adjustments or reminders if the athlete is missing structure.
- Encourage them if they seem frustrated, confused, or anxious.

Respond below:
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: '' }, // Empty user content because context is fully embedded
      ],
      temperature: 0.6,
      max_tokens: 600,
    });

    const feedback = completion.choices[0]?.message?.content?.trim() || '';

    return NextResponse.json({ feedback });
  } catch (err: any) {
    console.error('[COACH_FEEDBACK_ERROR]', err);
    return NextResponse.json({ error: 'Failed to generate feedback.' }, { status: 500 });
  }
}
