import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  startOfWeek,
  subWeeks,
  formatISO,
  isWithinInterval,
  parseISO,
  differenceInMinutes,
} from 'date-fns';
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

  // Step 1: Load profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('bike_ftp, run_threshold, swim_css, pace_units')
    .eq('id', user_id)
    .single();

  // Step 2: Load 4 weeks of data
  const now = new Date();
  const fourWeeksAgoStr = formatISO(subWeeks(now, 4), { representation: 'date' });

  const [{ data: sessions = [] }, { data: completed = [] }, { data: strava = [] }] =
    await Promise.all([
      supabase.from('sessions').select('*').eq('user_id', user_id).gte('date', fourWeeksAgoStr),
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

  // Step 3: Build summary text
  const summary = buildTrainingSummary(sessions ?? [], completed ?? [], strava ?? []);

  const systemPrompt = `You are a highly intelligent triathlon coach inside TrainGPT. The athlete is asking a question. You have access to their recent training history and performance metrics. Provide thoughtful and realistic feedback.

Performance metrics:
- Bike FTP: ${profile?.bike_ftp ?? 'unknown'}
- Run threshold pace: ${profile?.run_threshold ?? 'unknown'} seconds per ${profile?.pace_units ?? 'mile'}
- Swim CSS: ${profile?.swim_css ?? 'unknown'}

Recent training summary:
${summary}

Use this data to give specific advice — e.g. about race readiness, missed sessions, strengths/weaknesses, or improvement strategies.`.trim();

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

function buildTrainingSummary(
  sessions: any[],
  completed: any[],
  strava: any[]
): string {
  const weeks: Record<
    string,
    {
      planned: string[];
      completed: string[];
      strava: string[];
    }
  > = {};

  const weekOf = (dateStr: string) =>
    formatISO(startOfWeek(parseISO(dateStr), { weekStartsOn: 1 }), { representation: 'date' });

  for (const s of sessions) {
    const week = weekOf(s.date);
    weeks[week] ??= { planned: [], completed: [], strava: [] };
    weeks[week].planned.push(s.title);
  }

  for (const c of completed) {
    const week = weekOf(c.date);
    weeks[week] ??= { planned: [], completed: [], strava: [] };
    weeks[week].completed.push(c.session_title);
  }

  for (const a of strava) {
    const week = weekOf(a.start_date);
    const label = `${a.name} (${Math.round(a.moving_time / 60)}min ${a.sport_type})`;
    weeks[week] ??= { planned: [], completed: [], strava: [] };
    weeks[week].strava.push(label);
  }

  return Object.entries(weeks)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([week, data]) => {
      const planned = data.planned.length;
      const done = data.completed.length + data.strava.length;
      const percent = Math.round((done / (planned || 1)) * 100);

      return `- Week of ${week}: ${done}/${planned} completed (${percent}%)
    • Planned: ${data.planned.join(', ') || 'None'}
    • Completed: ${data.completed.join(', ') || 'None'}
    • Strava: ${data.strava.join(', ') || 'None'}`.trim();
    })
    .join('\n\n');
}
