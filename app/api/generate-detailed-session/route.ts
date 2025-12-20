import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { OpenAI } from 'openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Lazy OpenAI init:
 * - Prevents `next build` from crashing when OPENAI_API_KEY isn't set locally.
 * - Still throws a clear error at request time if the server is misconfigured.
 */
function getOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key.trim() === '') {
    throw new Error('OPENAI_API_KEY is missing');
  }
  return new OpenAI({ apiKey: key });
}

export async function POST(req: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { sessionId, date, title, details, sport, planId } = body ?? {};

    // You may have different required fields; keep this minimal but safe.
    if (!date || !title) {
      return NextResponse.json({ error: 'Missing required fields (date, title)' }, { status: 400 });
    }

    // --- Build prompt (keep yours if you already have one) ---
    const systemPrompt = `
You are a world-class endurance coach. Generate a detailed workout for the athlete.
Return concise, structured output:
- Workout Title
- Warmup (bullets)
- Main Set (bullets)
- Cooldown (bullets)
No fluff.
`.trim();

    const userPrompt = `
Date: ${date}
Sport: ${sport ?? 'unknown'}
Session: ${title}
Details: ${details ?? ''}
`.trim();

    const openai = getOpenAI();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const structured = completion.choices?.[0]?.message?.content?.trim() ?? '';

    // Optional: persist to Supabase if you’re doing that here
    // (I’m keeping it conservative: only update when we have a sessionId)
    if (sessionId && structured) {
      const { error: upErr } = await supabase
        .from('sessions')
        .update({ structured_workout: structured })
        .eq('id', sessionId)
        .eq('user_id', user.id);

      if (upErr) {
        console.error('[generate-detailed-session] supabase update error', upErr);
      }
    }

    return NextResponse.json({ ok: true, structured_workout: structured });
  } catch (err: any) {
    const msg = String(err?.message ?? err);

    // Nice error for misconfigured env
    if (msg.includes('OPENAI_API_KEY is missing')) {
      return NextResponse.json(
        { error: 'Server misconfigured: missing OPENAI_API_KEY' },
        { status: 500 }
      );
    }

    console.error('[generate-detailed-session] error', err);
    return NextResponse.json({ error: 'Failed to generate detailed session' }, { status: 500 });
  }
}
