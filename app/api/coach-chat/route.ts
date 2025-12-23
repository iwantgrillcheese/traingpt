// /app/api/coach-chat/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { OpenAI } from 'openai';
import {
  addDays,
  formatISO,
  isBefore,
  isWithinInterval,
  parseISO,
  startOfWeek,
  subWeeks,
} from 'date-fns';

import mergeSessionsWithStrava from '@/utils/mergeSessionWithStrava';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getOpenAIClient() {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key.trim() === '') throw new Error('OPENAI_API_KEY is missing');
  return new OpenAI({ apiKey: key });
}

function secondsToPace(sec: number | null | undefined, units: string = 'mile') {
  if (!sec || Number.isNaN(sec)) return 'unknown';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')} per ${units}`;
}

function getCurrentPlanWeek(plan: any[], today = new Date()) {
  const found = plan?.find((w: any) => {
    const start = parseISO(w.startDate);
    const end = addDays(start, 6);
    return isWithinInterval(today, { start, end });
  });
  if (found) return found;

  const past = (plan ?? [])
    .filter((w: any) => isBefore(parseISO(w.startDate), today))
    .sort(
      (a: any, b: any) =>
        parseISO(b.startDate).getTime() - parseISO(a.startDate).getTime()
    );

  return past[0] ?? plan?.[0];
}

function buildTrainingSummaryUsingMerge(sessions: any[], strava: any[]): string {
  const weeks: Record<
    string,
    { planned: any[]; matched: any[]; unmatched: any[] }
  > = {};

  const weekOf = (dateStr: string) =>
    formatISO(startOfWeek(parseISO(dateStr), { weekStartsOn: 1 }), {
      representation: 'date',
    });

  for (const s of sessions) {
    if (!s?.date) continue;
    const week = weekOf(s.date);
    weeks[week] ??= { planned: [], matched: [], unmatched: [] };
    weeks[week].planned.push(s);
  }

  for (const a of strava) {
    if (!a?.start_date) continue;
    const week = weekOf(a.start_date);
    weeks[week] ??= { planned: [], matched: [], unmatched: [] };
    weeks[week].unmatched.push(a);
  }

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

      const plannedList = data.planned
        .slice(0, 6)
        .map((s) => s.title)
        .filter(Boolean)
        .join(', ');

      const matchedList = data.matched
        .slice(0, 6)
        .map((m) => `${m.title} ✅`)
        .filter(Boolean)
        .join(', ');

      return `- Week of ${week}: ${done}/${planned} completed (${pct}%)
  • Planned: ${plannedList || 'None'}
  • Completed (matched): ${matchedList || 'None'}`;
    })
    .join('\n\n');
}

export async function POST(req: Request) {
  try {
    const { message: userMessage, history = [] } = await req.json();
    if (!userMessage) {
      return NextResponse.json({ error: 'Missing message' }, { status: 400 });
    }

    const supabase = createRouteHandlerClient({ cookies });

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user_id = user.id;

    const now = new Date();
    const todayStr = formatISO(now, { representation: 'date' });
    const fourWeeksAgoStr = formatISO(subWeeks(now, 4), { representation: 'date' });

    const [
      profileRes,
      planRes,
      sessionsRes,
      stravaRes,
      memoryRes,
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('bike_ftp, run_threshold, swim_css, pace_units')
        .eq('id', user_id)
        .single(),
      supabase
        .from('plans')
        .select('plan, raceType, raceDate, experience, maxHours, restDay')
        .eq('user_id', user_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('sessions')
        .select('*')
        .eq('user_id', user_id)
        .gte('date', fourWeeksAgoStr),
      supabase
        .from('strava_activities')
        .select('*')
        .eq('user_id', user_id)
        .gte('start_date', fourWeeksAgoStr),
      supabase
        .from('coach_memory')
        .select('summary, preferences')
        .eq('user_id', user_id)
        .maybeSingle(),
    ]);

    const profile = profileRes.data ?? null;
    const planRow = planRes.data ?? null;
    const fullPlan = planRow?.plan ?? [];
    const sessions = sessionsRes.data ?? [];
    const strava = stravaRes.data ?? [];

    const memorySummary = memoryRes.data?.summary ?? '';
    const memoryPrefs = memoryRes.data?.preferences ?? {};

    const summary = buildTrainingSummaryUsingMerge(sessions, strava);

    const currentWeek = getCurrentPlanWeek(fullPlan, now);
    const currentWeekLabel = currentWeek?.label ?? 'Unknown';
    const currentWeekStart = currentWeek?.startDate ?? 'Unknown';
    const sessionLines = Object.entries(currentWeek?.days ?? {})
      .map(([date, list]) => `• ${date}: ${(list as string[]).join(', ')}`)
      .join('\n');

    const systemPrompt = `
You are a smart, helpful triathlon coach inside TrainGPT.
Respond like a real coach: specific, practical, and honest. No filler.

Rules:
- Use the athlete's plan + Strava history below to ground answers.
- If data is missing, say what you can and what you can’t.
- Ask ONE clarifying question only if absolutely necessary.

📅 Today: ${todayStr}

🧠 Coach Memory (durable context)
${memorySummary ? memorySummary : 'None yet.'}

🧩 Preferences (json)
${JSON.stringify(memoryPrefs)}

📌 Plan Overview
• Race type: ${planRow?.raceType ?? 'unknown'}
• Race date: ${planRow?.raceDate ?? 'unknown'}
• Experience: ${planRow?.experience ?? 'unknown'}
• Max hours/week: ${planRow?.maxHours ?? 'unknown'}
• Preferred rest day: ${planRow?.restDay ?? 'unknown'}

📈 Performance Metrics
• Bike FTP: ${profile?.bike_ftp ?? 'unknown'}
• Run threshold: ${secondsToPace(profile?.run_threshold, profile?.pace_units)}
• Swim CSS: ${secondsToPace(profile?.swim_css, '100m')}

📅 This Week's Planned Sessions (${currentWeekLabel}, starting ${currentWeekStart})
${sessionLines || 'No sessions found'}

📅 Last 4 Weeks (planned vs matched Strava)
${summary || 'No history found'}
`.trim();

    const openai = getOpenAIClient();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        // keep history short so you don't blow tokens
        ...history.slice(-12),
        { role: 'user', content: userMessage },
      ],
    });

    const coachReply = completion.choices[0]?.message?.content?.trim();
    return NextResponse.json({ message: coachReply ?? 'No response generated' });
  } catch (err: any) {
    console.error('❌ /api/coach-chat error:', err);

    const msg = String(err?.message || '');
    if (msg.includes('OPENAI_API_KEY is missing')) {
      return NextResponse.json(
        { error: 'Server misconfigured: missing OPENAI_API_KEY' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Coach chat failed' },
      { status: 500 }
    );
  }
}
