// /app/api/generate-detailed-session/route.ts
import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { OpenAI } from 'openai';

export const runtime = 'nodejs';

const openai = new OpenAI();

export async function POST(req: Request) {
  const supabase = createServerComponentClient({ cookies });
  const body = await req.json();

  const { session_id, title, sport, date } = body;

  if (!session_id || !title || !sport || !date) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const prompt = `Generate a structured workout for the following ${sport} session: "${title}". Include a warmup, main set, and cooldown. Keep it concise and readable.`;

  try {
    const chatRes = await openai.chat.completions.create({
      model: 'gpt-4-1106-preview',
      messages: [
        { role: 'system', content: 'You are a triathlon coach.' },
        { role: 'user', content: prompt },
      ],
    });

    const detail = chatRes.choices[0]?.message?.content?.trim();

    if (!detail) {
      throw new Error('No response from OpenAI');
    }

    // Update the session with the generated detail
    const { error: dbError } = await supabase
      .from('sessions')
      .update({ details: detail })
      .eq('id', session_id);

    if (dbError) {
      console.error('Supabase update error:', dbError.message);
      return NextResponse.json({ error: 'Failed to save detail' }, { status: 500 });
    }

    return NextResponse.json({ detail });
  } catch (err) {
    console.error('GPT error:', err);
    return NextResponse.json({ error: 'GPT generation failed' }, { status: 500 });
  }
}
