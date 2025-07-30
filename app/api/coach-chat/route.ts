import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { startOfWeek, subWeeks, formatISO, isWithinInterval, parseISO } from 'date-fns';
import { OpenAI } from 'openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  const { message: userMessage } = await req.json();
  if (!userMessage) return NextResponse.json({ error: 'Missing message' }, { status: 400 });

  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user_id = user.id;

  // Step 1: Load user profile + performance metrics
  const { data: profile } = await supabase
    .from('profiles')
    .select('bike_ftp, run_threshold, swim_css, pace_units')
    .eq('id', user_id)
    .single();

  // Step 2: Load last 4 weeks of sessions + completions + strava
  const now = new Date();
  const fourWeeksAgo = subWeeks(now, 4);
  const fourWeeksAgoStr = formatISO(fourWeeksAgo, { representation: 'date' });

  const [{ data: sessions = [] }, { data: completed = [] }, { data: strava = [] }] =
    await Promise.all([
      supabase
        .from('sessions')
        .select('*')
        .eq('user_id', user_id)
        .gte('date', fourWeeksAgoStr),
      supabase
        .from('completed_sessions')
        .select('*')
        .eq('user_id', user_id)
        .gte('date', fourWeeksAgoStr),
      supabase
        .from('strava_activities')
        .select('*')
        .eq('user_id', user_id)
        .gte('start_date', fourWeeksAgoStr),
    ]);

  // Step 3: Compute basic stats
const recentSummary = summarizeTrainingByWeek(sessions ?? [], completed ?? []);

  // Step 4: Build system prompt
  const baseline = {
    bike_ftp: profile?.bike_ftp,
    run_threshold: profile?.run_threshold,
    swim_css: profile?.swim_css,
    pace_units: profile?.pace_units || 'mile',
  };

  const systemPrompt = `You are a highly intelligent triathlon coach inside TrainGPT. You have access to the athlete’s recent training history and performance metrics.

Their baseline performance:
- Bike FTP: ${baseline.bike_ftp ?? 'unknown'}
- Run Threshold Pace: ${baseline.run_threshold ?? 'unknown'} seconds per ${baseline.pace_units}
- Swim CSS: ${baseline.swim_css ?? 'unknown'}

Recent 4-week summary:
${recentSummary}

Use this information to answer questions thoughtfully.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    });

    const coachReply = completion.choices[0]?.message?.content?.trim();
    return NextResponse.json({ message: coachReply ?? 'No response generated' });
  } catch (err) {
    console.error('❌ GPT error:', err);
    return NextResponse.json({ error: 'GPT failed' }, { status: 500 });
  }
}

function summarizeTrainingByWeek(sessions: any[], completed: any[]) {
  const buckets: Record<string, { planned: number; completed: number }> = {};

  sessions.forEach((s) => {
    const weekStart = formatISO(startOfWeek(parseISO(s.date), { weekStartsOn: 1 }), {
      representation: 'date',
    });
    if (!buckets[weekStart]) buckets[weekStart] = { planned: 0, completed: 0 };
    buckets[weekStart].planned += 1;
  });

  completed.forEach((s) => {
    const weekStart = formatISO(startOfWeek(parseISO(s.date), { weekStartsOn: 1 }), {
      representation: 'date',
    });
    if (!buckets[weekStart]) buckets[weekStart] = { planned: 0, completed: 0 };
    buckets[weekStart].completed += 1;
  });

  return Object.entries(buckets)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(
      ([week, { planned, completed }]) =>
        `- Week of ${week}: ${completed}/${planned} sessions completed (${Math.round(
          (completed / (planned || 1)) * 100
        )}%)`
    )
    .join('\n');
}
