import { NextResponse } from 'next/server';
import { differenceInWeeks } from 'date-fns';
import OpenAI from 'openai';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const runtime = 'nodejs';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  const body = await req.json();

  const supabase = createServerComponentClient({ cookies });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user_id = session?.user?.id;
  if (!user_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const planLengthWeeks = differenceInWeeks(new Date(body.raceDate), new Date());
  const useGPT4 = body.experience === 'Advanced';
  const model = useGPT4 ? 'gpt-4-turbo' : 'gpt-3.5-turbo';

  const prompt = `...`; // ✂️ full prompt remains unchanged

  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content || '{}';
    const clean = content.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    await supabase.from('plans').upsert({
      user_id,
      plan: parsed.plan,
      coach_note: parsed.coachNote,
    });

    return NextResponse.json({
      success: true,
      plan: parsed.plan,
      coachNote: parsed.coachNote,
    });
  } catch (err) {
    console.error('❌ Finalize Plan Error:', err);
    return NextResponse.json({ error: 'Failed to finalize plan.' }, { status: 500 });
  }
}
