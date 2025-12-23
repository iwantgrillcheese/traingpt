// /app/api/coach-chat/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { OpenAI } from 'openai';
import {
  startOfWeek,
  subWeeks,
  formatISO,
  parseISO,
  addDays,
  isWithinInterval,
  isBefore,
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
  if (!sec || isNaN(sec)) return 'unknown';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')} per ${units}`;
}

function getCurrentPlanWeek(plan: any[], today = new Date()) {
  const week = plan?.find((w: any) => {
    const start = parseISO(w.startDate);
    const end = addDays(start, 6);
    return isWithinInterval(today, { start, end });
  });
  if (week) return week;

  const pastWeeks = (plan ?? [])
    .filter((w: any) => isBefore(parseISO(w.startDate), today))
    .sort((a: any, b: any) => parseISO(b.startDate).getTime() - parseISO(a.startDate).getTime());

  return pastWeeks[0] ?? (plan?.[0] ?? null);
}

/**
 * If the client accidentally calls GET (or you open the URL in a browser),
 * don't 405 — return a helpful response.
 */
export async function GET() {
  return NextResponse.json(
    { ok: true, message: 'Coach chat endpoint is live. Use POST with { message, history }.' },
    { status: 200 }
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const userMessage = body?.message;
    const history = Array.isArray(body?.history) ? body.history : [];

    if (!userMessage || typeof userMessage !== 'string') {
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

    // Coach memory (durable notes)
    const { data: coachMemory } = await supabase
      .from('coach_memory')
      .select('summary, preferences, updated_at')
      .eq('user_id', user_id)
      .maybeSingle();

    const memorySummary =
      coachMemory?.summary?.trim()?.length ? coachMemory.summary.trim() : 'No long-term notes yet.';
    const memoryPrefs =
      coachMemory?.preferences && Object.keys(coachMemory.preferences).length > 0
        ? JSON.stringify(coachMemory.preferences, null, 2)
        : '{}';
    const memoryUpdatedAt = coachMemory?.updated_at ?? 'unknown';

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

    const fullPlan = planRow?.plan ?? [];

    const now = new Date();
    const todayStr = formatISO(now, { representation: 'date' });
    const fourWeeksAgoStr = formatISO(subWeeks(now, 4), { representation: 'date' });

    const [{ data: sessions = [] }, { data: strava = [] }] = await Promise.all([
      supabase.from('sessions').select('*').eq('user_id', user_id).gte('date', fourWeeksAgoStr),
      supabase.from('strava_activities').select('*').eq('user_id', user_id),
    ]);

    const summary = buildTrainingSummaryUsingMerge(sessions ?? [], strava ?? []);

    const currentWeek = getCurrentPlanWeek(fullPlan) ?? {};
    const currentWeekLabel = currentWeek?.label ?? 'Unknown';
    const currentWeekStart = currentWeek?.startDate ?? 'Unknown';

    const sessionLines = Object.entries(currentWeek?.days ?? {})
      .map(([date, list]) => `• ${date}: ${(list as string[]).join(', ')}`)
      .join('\n');

    const systemPrompt = `
You are a smart, helpful triathlon coach inside TrainGPT. Respond like a real coach: conversational, realistic, and honest. Focus on what matters most. Don’t sugarcoat poor consistency, but be constructive.

Avoid:
- repeating training data unless relevant
- filler phrases / fake hype

---
📅 Today: ${todayStr}

🧠 Coach Memory
• Last updated: ${memoryUpdatedAt}
• Summary: ${memorySummary}
• Preferences (json): ${memoryPrefs}

📌 Plan Overview
• Race type: ${planRow?.raceType ?? 'unknown'}
• Race date: ${planRow?.raceDate ?? 'unknown'}
• Experience: ${planRow?.experience ?? 'unknown'}
• Max hours/week: ${planRow?.maxHours ?? 'unknown'}
• Rest day: ${planRow?.restDay ?? 'unknown'}

📈 Performance
• Bike FTP: ${profile?.bike_ftp ?? 'unknown'}
• Run threshold: ${secondsToPace(profile?.run_threshold, profile?.pace_units)}
• Swim CSS: ${secondsToPace(profile?.swim_css, '100m')}

📅 This Week (${currentWeekLabel}, starting ${currentWeekStart})
${sessionLines || 'No sessions found'}

📅 Last 4 Weeks (planned vs matched Strava)
${summary}
`.trim();

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
    return NextResponse.json({ message: coachReply ?? 'No response generated' }, { status: 200 });
  } catch (err: any) {
    console.error('❌ /api/coach-chat error:', err);
    const msg = String(err?.message || '');

    if (msg.includes('OPENAI_API_KEY is missing')) {
      return NextResponse.json({ error: 'Server misconfigured: missing OPENAI_API_KEY' }, { status: 500 });
    }

    return NextResponse.json({ error: 'Coach chat failed' }, { status: 500 });
  }
}

function buildTrainingSummaryUsingMerge(sessions: any[], strava: any[]): string {
  const weeks: Record<string, { planned: any[]; matched: any[]; bucket: any[] }> = {};

  const weekOf = (dateStr: string) =>
    formatISO(startOfWeek(parseISO(dateStr), { weekStartsOn: 1 }), { representation: 'date' });

  for (const s of sessions) {
    const week = weekOf(s.date);
    weeks[week] ??= { planned: [], matched: [], bucket: [] };
    weeks[week].planned.push(s);
  }

  for (const a of strava) {
    const week = weekOf(a.start_date);
    weeks[week] ??= { planned: [], matched: [], bucket: [] };
    weeks[week].bucket.push(a);
  }

  for (const [week, data] of Object.entries(weeks)) {
    if (!data.planned.length || !data.bucket.length) continue;
    const { merged } = mergeSessionsWithStrava(data.planned, data.bucket);
    data.matched = merged.filter((m) => !!m.stravaActivity);
  }

  return Object.entries(weeks)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([week, data]) => {
      const planned = data.planned.length;
      const done = data.matched.length;
      const pct = planned > 0 ? Math.round((done / planned) * 100) : 0;

      const plannedList = data.planned.slice(0, 6).map((s) => s.title).join(', ');
      const matchedList = data.matched.slice(0, 6).map((m) => `${m.title} ✅`).join(', ');

      return `- Week of ${week}: ${done}/${planned} completed (${pct}%)
  • Planned: ${plannedList || 'None'}
  • Completed (matched): ${matchedList || 'None'}`;
    })
    .join('\n\n');
}
