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

function getOpenAI() {
  const key = process.env.OPENAI_API_KEY;

  if (!key) {
    throw new Error('Missing OPENAI_API_KEY');
  }

  return new OpenAI({ apiKey: key });
}

function compactActivityBrief(activity: any) {
  return {
    name: activity?.name ?? null,
    sport_type: activity?.sport_type ?? null,
    start_date_local: activity?.start_date_local ?? activity?.start_date ?? null,
    moving_time_sec: activity?.moving_time ?? null,
    distance_m: activity?.distance ?? null,
    elevation_gain_m: activity?.total_elevation_gain ?? null,
    avg_hr: activity?.average_heartrate ?? null,
    max_hr: activity?.max_heartrate ?? null,
    avg_speed_mps: activity?.average_speed ?? null,
    avg_watts: activity?.average_watts ?? null,
    weighted_avg_watts: activity?.weighted_average_watts ?? null,
    kilojoules: activity?.kilojoules ?? null,
    trainer: activity?.trainer ?? null,
    device_watts: activity?.device_watts ?? null,
  };
}

export async function POST(req: Request) {
  try {
    const supabase = await createRouteSupabaseClient();
    const user = await requireUser(supabase);

    const body = await req.json().catch(() => ({}));
    const stravaId = Number(body?.stravaId);

    if (!stravaId || Number.isNaN(stravaId)) {
      return NextResponse.json(
        { error: 'Missing or invalid stravaId.' },
        { status: 400 }
      );
    }

    const { data: activity, error: activityError } = await supabase
      .from('strava_activities')
      .select('*')
      .eq('user_id', user.id)
      .eq('strava_id', stravaId)
      .maybeSingle();

    if (activityError) {
      console.error('[strava/analyze] activity lookup failed:', activityError);

      return NextResponse.json(
        { error: activityError.message },
        { status: 500 }
      );
    }

    if (!activity) {
      return NextResponse.json(
        { error: 'Activity not found.' },
        { status: 404 }
      );
    }

    const brief = compactActivityBrief(activity);
    const client = getOpenAI();

    const system = `
You are a world-class endurance coach. You write in a calm, premium tone.

Goal: analyze a completed training activity and produce actionable coaching feedback.

Rules:
- Be concise. No fluff. No emojis.
- Use concrete interpretations of the provided metrics.
- If a metric is missing, do not invent it.
- Output must be plain text with short sections.

Structure:
1) Coach summary
2) Intensity & load
3) What this means for the next 24-48 hours
4) One improvement focus
`.trim();

    const userPrompt = `
Analyze this Strava activity:

${JSON.stringify(brief, null, 2)}

Helpful interpretation hints:
- Distance is meters.
- Speed is meters per second.
- Moving time is seconds.
- For runs, translate average speed into pace per mile.
- For rides, translate average speed into mph.

Return the structured coaching feedback.
`.trim();

    const response = await client.chat.completions.create(
      stripUnsupportedParams({
        model: process.env.OPENAI_ANALYZE_MODEL || 'gpt-4o',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userPrompt },
        ],
      })
    );

    const analysis = response.choices?.[0]?.message?.content?.trim() ?? '';

    return NextResponse.json({ analysis });
  } catch (error: any) {
    console.error('[strava/analyze] failed:', error);

    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: error?.message ?? 'Failed to analyze activity.' },
      { status: 500 }
    );
  }
}