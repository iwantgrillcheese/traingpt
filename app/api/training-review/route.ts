import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { OpenAI } from 'openai';
import { stripUnsupportedParams } from '@/utils/openaiSafeParams';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type SessionRow = {
  id: string;
  user_id: string;
  date: string;
  sport: string | null;
  title: string | null;
  duration: number | null;
  details: string | null;
  structured_workout: string | null;
  athlete_notes: string | null;
  strava_id: number | null;
};

function isAllowed(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return true;
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const query = req.nextUrl.searchParams.get('secret') ?? '';
  return token === secret || query === secret;
}

function getClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('Missing OPENAI_API_KEY');
  return new OpenAI({ apiKey: key });
}

function getDb() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing database config');
  return createClient(url, key);
}

function compactActivity(activity: any) {
  if (!activity) return null;
  return {
    moving_time_sec: activity.moving_time ?? null,
    distance_m: activity.distance ?? null,
    avg_hr: activity.average_heartrate ?? null,
    max_hr: activity.max_heartrate ?? null,
    avg_speed_mps: activity.average_speed ?? null,
    avg_watts: activity.average_watts ?? null,
    weighted_avg_watts: activity.weighted_average_watts ?? null,
    kilojoules: activity.kilojoules ?? null,
    elevation_gain_m: activity.total_elevation_gain ?? null,
  };
}

async function writeReply(input: { session: SessionRow; activity: any; nextSessions: any[] }) {
  const client = getClient();
  const system = [
    'You are a practical endurance training assistant replying to a workout note.',
    'Acknowledge the specific thing the athlete wrote.',
    'Connect the note to the planned session and completed activity data.',
    'Give one practical training takeaway for the next 24-48 hours.',
    'Write 2-4 sentences.',
    'Sound like a real triathlon coach leaving a training log comment.',
    'Do not invent feelings or data.',
    'Avoid generic praise unless tied to a specific observation.',
  ].join('\n');

  const user = JSON.stringify({
    athlete_note: input.session.athlete_notes,
    planned_session: {
      date: input.session.date,
      sport: input.session.sport,
      title: input.session.title,
      duration_min: input.session.duration,
      details: input.session.details,
      structured_workout: input.session.structured_workout,
    },
    completed_activity: compactActivity(input.activity),
    next_sessions: input.nextSessions,
    output: 'Return only the reply text.',
  }, null, 2);

  const response = await client.chat.completions.create(
    stripUnsupportedParams({
      model: process.env.OPENAI_COACH_REPLY_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    })
  );

  return response.choices?.[0]?.message?.content?.trim() ?? '';
}

async function run(req: NextRequest) {
  if (!isAllowed(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getDb();
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 20), 40);
  const userId = req.nextUrl.searchParams.get('userId');

  let query = supabase
    .from('sessions')
    .select('id, user_id, date, sport, title, duration, details, structured_workout, athlete_notes, strava_id')
    .eq('coach_response_status', 'pending')
    .not('athlete_notes', 'is', null)
    .order('date', { ascending: false })
    .limit(limit);

  if (userId) query = query.eq('user_id', userId);

  const { data: sessions, error } = await query;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  let generated = 0;
  const errors: Array<{ sessionId: string; error: string }> = [];

  for (const session of (sessions ?? []) as SessionRow[]) {
    try {
      let activity: any = null;
      if (session.strava_id) {
        const { data } = await supabase
          .from('strava_activities')
          .select('*')
          .eq('user_id', session.user_id)
          .eq('strava_id', session.strava_id)
          .maybeSingle();
        activity = data ?? null;
      }

      const { data: nextSessions } = await supabase
        .from('sessions')
        .select('date, sport, title, duration, details')
        .eq('user_id', session.user_id)
        .gt('date', session.date)
        .order('date', { ascending: true })
        .limit(2);

      const reply = await writeReply({ session, activity, nextSessions: nextSessions ?? [] });
      if (!reply) throw new Error('Empty reply');

      const { error: updateError } = await supabase
        .from('sessions')
        .update({
          coach_response: reply,
          coach_response_status: 'generated',
          coach_response_generated_at: new Date().toISOString(),
          coach_response_note_snapshot: session.athlete_notes,
        })
        .eq('id', session.id);

      if (updateError) throw updateError;
      generated += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ sessionId: session.id, error: message });
      await supabase.from('sessions').update({ coach_response_status: 'failed' }).eq('id', session.id);
    }
  }

  return NextResponse.json({ success: true, checked: sessions?.length ?? 0, generated, errors });
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
