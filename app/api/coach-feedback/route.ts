// /app/api/generate-detailed-session/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { OpenAI } from 'openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const getPromptBySport = (sport: string, title: string, date: string) => {
  const lower = sport.toLowerCase();
  const base = `You're a world-class triathlon coach. Create a structured workout for this session:\n\nTitle: ${title}\nSport: ${sport}\nDate: ${date}`;

  if (lower === 'swim') {
    return `${base}\n\nRespond in this format:\n• Warmup: ...\n• Drills: ... (if any)\n• Main Set: ...\n• Cooldown: ...\n\nUse meters and include pacing or technique cues.`;
  }
  if (lower === 'bike') {
    return `${base}\n\nRespond in this format:\n• Warmup: ...\n• Main Set: ... (include FTP zones or RPE)\n• Cooldown: ...\n\nUse time-based intervals.`;
  }
  if (lower === 'run') {
    return `${base}\n\nRespond in this format:\n• Warmup: ...\n• Main Set: ... (include pace or zone)\n• Cooldown: ...`;
  }
  if (lower === 'strength') {
    return `${base}\n\nRespond in this format:\n• Warmup: ...\n• Main Set: ... (reps, sets)\n• Cooldown: ...\n\nFocus on mobility and injury prevention.`;
  }

  return `${base}\n\nRespond in this format:\n• Warmup: ...\n• Main Set: ...\n• Cooldown: ...`;
};

export async function POST(req: Request) {
  const supabase = createServerComponentClient({ cookies });
  const { session_id, title, sport, date } = await req.json();

  if (!session_id || !title || !sport || !date) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  const prompt = getPromptBySport(sport, title, date);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a world-class triathlon coach.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const output = completion.choices[0]?.message?.content?.trim();

    if (!output) {
      return NextResponse.json({ error: 'No output from GPT' }, { status: 500 });
    }

    // Save result into Supabase
    const { error } = await supabase
      .from('sessions')
      .update({ structured_workout: output })
      .eq('id', session_id);

    if (error) {
      console.error('❌ Supabase update error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ structured_workout: output });
  } catch (err) {
    console.error('❌ GPT error:', err);
    return NextResponse.json({ error: 'GPT generation failed' }, { status: 500 });
  }
}
