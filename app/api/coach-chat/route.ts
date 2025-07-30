import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  startOfWeek,
  subWeeks,
  formatISO,
  parseISO,
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

  // Load profile + plan
  const { data: profile } = await supabase
    .from('profiles')
    .select('bike_ftp, run_threshold, swim_css, pace_units')
    .eq('id', user_id)
    .single();

  const { data: planMeta } = await supabase
    .from('plans')
    .select('raceType, raceDate, experience, maxHours, restDay')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Load 4 weeks of sessions, completions, strava
  const now = new Date();
  const fourWeeksAgoStr = formatISO(subWeeks(now, 4), { representation: 'date' });

  const [{ data: sessions = [] }, { data: completed = [] }, { data: strava = [] }] =
    await Promise.all([
      supabase.from('sessions').select('*').eq('user_id', user_id).gte('date', fourWeeksAgoStr),
      supabase
        .from('completed_sessions')
        .select('*')
        .eq('user_id', user_id)
        .gte('session_date', fourWeeksAgoStr),
      supabase
        .from('strava_activities')
        .select('*')
        .eq('user_id', user_id)
        .gte('start_date', fourWeeksAgoStr),
    ]);

  const todayStr = formatISO(now, { representation: 'date' });
  const summary = buildTrainingSummary(sessions ?? [], completed ?? [], strava ?? []);

  const systemPrompt = `
You are a smart, helpful triathlon coach inside TrainGPT. The athlete is asking a question. Respond like a real coach: conversational, realistic, and honest — not robotic or overly formal.

Focus on what matters most. Don’t sugarcoat poor consistency, but do be encouraging and constructive.

Avoid:
- repeating training data unless relevant
- fake enthusiasm or filler phrases like “You’ve got this!”

---

📅 Today’s Date: ${todayStr}

📌 Plan Overview
• Race type: ${planMeta?.raceType ?? 'unknown'}
• Race date: ${planMeta?.raceDate ?? 'unknown'}
• Experience level: ${planMeta?.experience ?? 'unknown'}
• Max hours/week: ${planMeta?.maxHours ?? 'unknown'}
• Preferred rest day: ${planMeta?.restDay ?? 'unknown'}

📈 Performance Metrics
• Bike FTP: ${profile?.bike_ftp ?? 'unknown'}
• Run threshold: ${profile?.run_threshold ?? 'unknown'} sec/${profile?.pace_units ?? 'mile'}
• Swim CSS: ${profile?.swim_css ?? 'unknown'}

📅 Training History (Last 4 Weeks)
${summary}

---
`.trim();

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
    const week = weekOf(c.session_date);
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
    .sort(([a], [b]) => (a < b ? 1 : -1)) // most recent first
    .map(([week, data]) => {
      const planned = data.planned.length;
      const done = data.completed.length + data.strava.length;
      const percent = Math.round((done / (planned || 1)) * 100);

      return `- Week of ${week}: ${done}/${planned} completed (${percent}%)
  • Planned: ${data.planned.join(', ') || 'None'}
  • Completed: ${data.completed.join(', ') || 'None'}
  • Strava: ${data.strava.join(', ') || 'None'}`;
    })
    .join('\n\n');
}
