// /app/api/coach-feedback/route.ts

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import {
  startOfWeek,
  subWeeks,
  formatISO,
  parseISO,
  addDays,
  isWithinInterval,
  isBefore,
  isEqual,
} from 'date-fns';
import { OpenAI } from 'openai';
import mergeSessionsWithStrava from '@/utils/mergeSessionWithStrava';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getOpenAIClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key.trim() === '') throw new Error('OPENAI_API_KEY is missing');
  return new OpenAI({ apiKey: key });
}

function secondsToPace(sec: number | null | undefined, units: string = 'mile') {
  if (!sec || isNaN(sec)) return 'unknown';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')} per ${units}`;
}

function getCurrentPlanWeek(plan: any[], today = new Date()) {
  const week = plan.find((w) => {
    const start = parseISO(w.startDate);
    const end = addDays(start, 6);
    return isWithinInterval(today, { start, end });
  });

  if (week) return week;

  const pastWeeks = plan
    .filter((w) => isBefore(parseISO(w.startDate), today))
    .sort((a, b) => parseISO(b.startDate).getTime() - parseISO(a.startDate).getTime());

  return pastWeeks[0] ?? plan[0];
}

export async function POST(req: Request) {
  const { message: userMessage, history = [] } = await req.json();
  if (!userMessage) return NextResponse.json({ error: 'Missing message' }, { status: 400 });

  const supabase = createRouteHandlerClient({ cookies });

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user_id = user.id;

  const { data: profile } = await supabase
    .from('profiles')
    .select('bike_ftp, run_threshold, swim_css, pace_units')
    .eq('id', user_id)
    .single();

  const { data: planRow } = await supabase
    .from('plans')
    .select('plan, raceType, raceDate, experience, maxHours, restDay')
    .eq('user_id', user_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const planMeta = planRow;
  const fullPlan = planRow?.plan ?? [];

  const now = new Date();
  const todayStr = formatISO(now, { representation: 'date' });
  const fourWeeksAgoStr = formatISO(subWeeks(now, 4), { representation: 'date' });

  const [{ data: sessions = [] }, { data: completed = [] }, { data: strava = [] }] =
    await Promise.all([
      supabase.from('sessions').select('*').eq('user_id', user_id).gte('date', fourWeeksAgoStr),
      supabase.from('completed_sessions').select('*').eq('user_id', user_id),
      supabase.from('strava_activities').select('*').eq('user_id', user_id),
    ]);

  const summary = buildTrainingSummaryUsingMerge(sessions ?? [], strava ?? []);

  const currentWeek = getCurrentPlanWeek(fullPlan);
  const currentWeekLabel = currentWeek?.label ?? 'Unknown';
  const currentWeekStart = currentWeek?.startDate ?? 'Unknown';

  const sessionLines = Object.entries(currentWeek?.days ?? {})
    .map(([date, list]) => `• ${date}: ${(list as string[]).join(', ')}`)
    .join('\n');

  const systemPrompt = `
You are a smart, helpful triathlon coach inside TrainGPT. The athlete is asking a question. Respond like a real coach: conversational, realistic, and honest — not robotic or overly formal. Focus on what matters most. Don’t sugarcoat poor consistency, but do be encouraging and constructive.

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
• Run threshold: ${secondsToPace(profile?.run_threshold, profile?.pace_units)}
• Swim CSS: ${secondsToPace(profile?.swim_css, '100m')}

📅 This Week's Planned Sessions (${currentWeekLabel}, starting ${currentWeekStart})
${sessionLines || 'No sessions found'}

📅 Training History (Last 4 Weeks — planned vs matched Strava)
${summary}
`.trim();

  try {
    const openai = getOpenAIClient();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        ...history.slice(-12),
        { role: 'user', content: userMessage },
      ],
    });

    const coachReply = completion.choices[0]?.message?.content?.trim();
    return NextResponse.json({ message: coachReply ?? 'No response generated' });
  } catch (err: any) {
    console.error('❌ GPT error:', err);

    if (String(err?.message || '').includes('OPENAI_API_KEY is missing')) {
      return NextResponse.json({ error: 'Server misconfigured: missing OPENAI_API_KEY' }, { status: 500 });
    }
    return NextResponse.json({ error: 'GPT failed' }, { status: 500 });
  }
}

/**
 * IMPORTANT: your old buildTrainingSummary double-counted:
 * completed_sessions + strava uploads. That makes % nonsense.
 *
 * This version uses mergeSessionsWithStrava to count "completed" only when a planned session matched Strava.
 */
function buildTrainingSummaryUsingMerge(sessions: any[], strava: any[]): string {
  const weeks: Record<string, { planned: any[]; matched: any[]; unmatched: any[] }> = {};

  const weekOf = (dateStr: string) =>
    formatISO(startOfWeek(parseISO(dateStr), { weekStartsOn: 1 }), { representation: 'date' });

  for (const s of sessions) {
    const week = weekOf(s.date);
    weeks[week] ??= { planned: [], matched: [], unmatched: [] };
    weeks[week].planned.push(s);
  }

  // group strava into same week buckets
  for (const a of strava) {
    const week = weekOf(a.start_date);
    weeks[week] ??= { planned: [], matched: [], unmatched: [] };
    weeks[week].unmatched.push(a);
  }

  // merge per week (planned vs strava)
  for (const [week, data] of Object.entries(weeks)) {
    if (!data.planned.length || !data.unmatched.length) continue;
    const { merged, unmatched } = mergeSessionsWithStrava(data.planned, data.unmatched);
    data.matched = merged.filter((m) => !!m.stravaActivity);
    data.unmatched = unmatched;
  }

  return Object.entries(weeks)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([week, data]) => {
      const planned = data.planned.length;
      const done = data.matched.length;
      const pct = planned > 0 ? Math.round((done / planned) * 100) : 0;

      const plannedList = data.planned.slice(0, 6).map((s) => s.title).join(', ');
      const matchedList = data.matched
        .slice(0, 6)
        .map((m) => `${m.title} ✅`)
        .join(', ');

      return `- Week of ${week}: ${done}/${planned} completed (${pct}%)
  • Planned: ${plannedList || 'None'}
  • Completed (matched): ${matchedList || 'None'}`;
    })
    .join('\n\n');
}
