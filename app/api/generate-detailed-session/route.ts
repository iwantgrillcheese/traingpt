import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import {
  AuthError,
  createRouteSupabaseClient,
  requireUser,
} from '@/lib/supabase/server';
import { stripUnsupportedParams } from '@/utils/openaiSafeParams';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FuelingPayload = {
  enabled?: boolean;
  bodyWeightKg?: number | null;
  bodyFatPct?: number | null;
  workoutDurationMin?: number | null;
  sweatRateLPerHour?: number | null;
};

type GenerateDetailedSessionPayload = {
  sessionId?: string | null;
  date?: string | null;
  title?: string | null;
  details?: string | null;
  sport?: string | null;
  planId?: string | null;
  fueling?: FuelingPayload | null;
};

function getOpenAI() {
  const key = process.env.OPENAI_API_KEY;

  if (!key || key.trim() === '') {
    throw new Error('OPENAI_API_KEY is missing');
  }

  return new OpenAI({ apiKey: key });
}

function finiteNumberOrNull(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export async function POST(req: Request) {
  try {
    const supabase = await createRouteSupabaseClient(req);
    const user = await requireUser(supabase);
    const body = (await req.json()) as GenerateDetailedSessionPayload;

    const sessionId = body.sessionId?.trim() || null;
    const date = body.date?.trim() || null;
    const title = body.title?.trim() || null;
    const details = body.details?.trim() || '';
    const sport = body.sport?.trim() || 'unknown';

    const fuelingEnabled = body.fueling?.enabled === true;

    const fuelingContext = fuelingEnabled
      ? {
          bodyWeightKg: finiteNumberOrNull(body.fueling?.bodyWeightKg),
          bodyFatPct: finiteNumberOrNull(body.fueling?.bodyFatPct),
          workoutDurationMin: finiteNumberOrNull(body.fueling?.workoutDurationMin),
          sweatRateLPerHour: finiteNumberOrNull(body.fueling?.sweatRateLPerHour),
        }
      : null;

    if (!date || !title) {
      return NextResponse.json(
        { error: 'Missing required fields: date and title are required.' },
        { status: 400 }
      );
    }

    const systemPrompt = `
You are a world-class endurance coach. Generate a detailed workout for the athlete.

Return concise, structured output in exactly this layout:

Workout Title: <one line>
Warmup:
- <bullet>
Main Set:
- <bullet>
Cooldown:
- <bullet>
Fueling:
- <bullet> (only if fueling guidance is requested)

Rules:
- Keep bullets short and practical.
- No motivational filler.
- No long paragraphs.
- Match the prescribed workout intent.
- Do not make the workout dramatically harder than the original session.
`.trim();

    const userPrompt = `
Date: ${date}
Sport: ${sport}
Session: ${title}
Details: ${details || 'No additional details provided.'}
Fueling requested: ${fuelingEnabled ? 'yes' : 'no'}
${
  fuelingEnabled
    ? `Fueling athlete context:
- Body weight (kg): ${fuelingContext?.bodyWeightKg ?? 'not provided'}
- Body fat (%): ${fuelingContext?.bodyFatPct ?? 'not provided'}
- Planned duration (min): ${fuelingContext?.workoutDurationMin ?? 'not provided'}
- Sweat rate (L/hr): ${fuelingContext?.sweatRateLPerHour ?? 'not provided'}

If fueling is requested, add a Fueling section with:
- Pre-workout fueling and hydration
- During-workout carbs, fluids, and sodium targets
- Post-workout recovery fueling
Use ranges when precision is uncertain and clearly label assumptions.`
    : ''
}
`.trim();

    const openai = getOpenAI();

    const completion = await openai.chat.completions.create(
      stripUnsupportedParams({
        model: 'gpt-4-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      })
    );

    const structuredWorkout = completion.choices?.[0]?.message?.content?.trim() ?? '';

    if (!structuredWorkout) {
      return NextResponse.json(
        { error: 'No detailed workout was generated.' },
        { status: 502 }
      );
    }

    if (sessionId) {
      const { error: updateError } = await supabase
        .from('sessions')
        .update({
          structured_workout: structuredWorkout,
          details: structuredWorkout,
        })
        .eq('id', sessionId)
        .eq('user_id', user.id);

      if (updateError) {
        console.error('[generate-detailed-session] session update failed:', updateError);

        return NextResponse.json(
          {
            error: 'Generated workout, but failed to save it.',
            structured_workout: structuredWorkout,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      structured_workout: structuredWorkout,
    });
  } catch (error: any) {
    const message = String(error?.message ?? error);

    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    if (message.includes('OPENAI_API_KEY is missing')) {
      return NextResponse.json(
        { error: 'Server misconfigured: missing OPENAI_API_KEY.' },
        { status: 500 }
      );
    }

    console.error('[generate-detailed-session] failed:', error);

    return NextResponse.json(
      { error: 'Failed to generate detailed session.' },
      { status: 500 }
    );
  }
}
