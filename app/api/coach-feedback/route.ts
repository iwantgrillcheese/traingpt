import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      messages = [],
      userNote = '',
      upcomingSessions = [],
      raceType = 'Olympic',
      raceDate = '',
      experienceLevel = 'Intermediate',
      userGoals = 'Not provided',
    } = body;

    const supabase = createServerComponentClient({ cookies });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: planData } = await supabase
      .from('plans')
      .select('plan')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const plan = planData?.plan || [];

    const planSummary = plan
      .map((week: any) => {
        const days = Object.entries(week.days)
          .map(([date, sessions]) => `- ${date}: ${(sessions as string[]).join(', ')}`)
          .join('\n');
        return `Week: ${week.label}\n${days}`;
      })
      .join('\n\n') || 'No plan data available.';

    const chatHistory = messages
      .map((msg: any) => `${msg.role === 'user' ? 'Athlete' : 'Coach'}: ${msg.content}`)
      .join('\n');

    const systemPrompt = `
You are a world-class triathlon coach specializing in real-time, personalized support for endurance athletes.
You are the official AI coach of TrainGPT — your job is to help athletes train smarter, stay motivated, and get race-day ready.

---

# 🎯 Core Directives
- **Coach, don't lecture:** Keep answers practical, not theoretical.
- **Connect to training:** Tie advice into their actual plan if helpful.
- **Coach with heart:** Be supportive when the athlete is unsure or struggling.
- **Be brief but thoughtful:** Avoid unnecessary jargon, but deliver real coaching.
- **Respect phase and race date:** Frame advice based on where they are in their journey.

---

# 📋 Athlete Context
- Race Type: ${raceType}
- Race Date: ${raceDate || 'Not provided'}
- Experience Level: ${experienceLevel}
- Stated Goal(s): ${userGoals}
- Upcoming Sessions:
${upcomingSessions.length > 0 ? upcomingSessions.map((s: string) => `  - ${s}`).join('\n') : '  - None scheduled'}
- Full Plan Overview:
${planSummary}

---

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
        { role: 'user', content: '' },
      ],
      temperature: 0.6,
      max_tokens: 700,
    });

    const feedback = completion.choices[0]?.message?.content?.trim() || '';
    return NextResponse.json({ feedback });
  } catch (err: any) {
    console.error('[COACH_FEEDBACK_ERROR]', err);
    return NextResponse.json({ error: 'Failed to generate feedback.' }, { status: 500 });
  }
}
