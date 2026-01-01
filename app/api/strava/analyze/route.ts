import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { OpenAI } from 'openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('Missing OPENAI_API_KEY');
  return new OpenAI({ apiKey: key });
}

function compactActivityBrief(a: any) {
  return {
    name: a?.name ?? null,
    sport_type: a?.sport_type ?? null,
    start_date_local: a?.start_date_local ?? a?.start_date ?? null,
    moving_time_sec: a?.moving_time ?? null,
    distance_m: a?.distance ?? null,
    elevation_gain_m: a?.total_elevation_gain ?? null,
    avg_hr: a?.average_heartrate ?? null,
    max_hr: a?.max_heartrate ?? null,
    avg_speed_mps: a?.average_speed ?? null,
    avg_watts: a?.average_watts ?? null,
    weighted_avg_watts: a?.weighted_average_watts ?? null,
    kilojoules: a?.kilojoules ?? null,
    trainer: a?.trainer ?? null,
    device_watts: a?.device_watts ?? null,
  };
}

export async function POST(req: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 401 });
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const stravaId = Number(body?.stravaId);

    if (!stravaId || Number.isNaN(stravaId)) {
      return NextResponse.json({ error: 'Missing or invalid stravaId' }, { status: 400 });
    }

    const { data: activity, error: actErr } = await supabase
      .from('strava_activities')
      .select('*')
      .eq('user_id', user.id)
      .eq('strava_id', stravaId)
      .maybeSingle();

    if (actErr) return NextResponse.json({ error: actErr.message }, { status: 500 });
    if (!activity) return NextResponse.json({ error: 'Activity not found' }, { status: 404 });

    const brief = compactActivityBrief(activity);

    const client = getOpenAI();

    const system = `
You are a world-class endurance coach. You write in a calm, premium tone.
Goal: analyze a completed training activity and produce actionable coaching feedback.

Rules:
- Be concise. No fluff. No emojis.
- Use concrete interpretations of the provided metrics.
- If a metric is missing, don't invent it.
- Output must be plain text with short sections.
Structure:
1) Coach summary (2-3 sentences)
2) Intensity & load (what it suggests; mention HR/power only if present)
3) What this means for the next 24-48 hours (recovery or key next workout suggestion)
4) One improvement focus (technique/pacing/fueling/structure)
`;

    const userPrompt = `
Analyze this Strava activity:

${JSON.stringify(brief, null, 2)}

Helpful interpretation hints (use only if relevant):
- Distance is meters, speed is m/s, moving_time is seconds.
- For runs: translate avg_speed into pace per mile.
- For rides: translate avg_speed into mph.
Return the structured coaching feedback.
`;

    const resp = await client.chat.completions.create({
      model: process.env.OPENAI_ANALYZE_MODEL || 'gpt-4o',
      messages: [
        { role: 'system', content: system.trim() },
        { role: 'user', content: userPrompt.trim() },
      ],
      temperature: 0.4,
    });

    const analysis = resp.choices?.[0]?.message?.content?.trim() ?? '';

    return NextResponse.json({ analysis });
  } catch (e: any) {
    console.error('[strava/analyze] error', e);
    return NextResponse.json(
      { error: e?.message ?? 'Unknown error' },
      { status: 500 }
    );
  }
}
