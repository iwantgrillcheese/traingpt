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

function isoDateFromAnyDateLike(value: any): string | null {
  if (!value) return null;

  // Supabase timestamps usually come back as ISO strings
  if (typeof value === 'string') {
    // If it's already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    // Else parse ISO datetime
    try {
      return formatISO(parseISO(value), { representation: 'date' });
    } catch {
      return null;
    }
  }

  // JS Date
  if (value instanceof Date && !isNaN(value.getTime())) {
    return formatISO(value, { representation: 'date' });
  }

  return null;
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

    // --- Date windows (source of truth)
    const now = new Date();
    const todayStr = formatISO(now, { representation: 'date' });

    // "Last 4 weeks" = last 28 days ending today (NOT "last 4 plan weeks")
    const fourWeeksAgo = subWeeks(now, 4);
    const fourWeeksAgoStr = formatISO(fourWeeksAgo, { representation: 'date' });

    // "This week" = Monday..Sunday window containing today
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekStartStr = formatISO(weekStart, { representation: 'date' });
    const weekEndStr = formatISO(addDays(weekStart, 6), { representation: 'date' });

    // --- Coach memory (read-only for now; you aren't writing it anywhere yet)
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

    // --- Profile (performance)
    const { data: profile } = await supabase
      .from('profiles')
      .select('bike_ftp, run_threshold, swim_css, pace_units')
      .eq('id', user_id)
      .single();

    // --- Plan overview (metadata)
    const { data: planRow } = await supabase
      .from('plans')
      .select('plan, raceType, raceDate, experience, maxHours, restDay')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // --- Data fetches (THIS is what was broken before)
    // 1) Sessions in last 28 days (bounded to today — prevents future weeks from leaking in)
    // 2) Strava activities in last 28 days (bounded; uses local timestamp)
    // 3) Sessions in this week window (matches schedule page source)
    const [
      { data: recentSessions = [], error: recentSessionsErr },
      { data: recentStrava = [], error: recentStravaErr },
      { data: thisWeekSessions = [], error: thisWeekErr },
    ] = await Promise.all([
      supabase
        .from('sessions')
        .select('*')
        .eq('user_id', user_id)
        .gte('date', fourWeeksAgoStr)
        .lte('date', todayStr),

      supabase
        .from('strava_activities')
        .select('*')
        .eq('user_id', user_id)
        .gte('start_date_local', fourWeeksAgo)
        .lte('start_date_local', now),

      supabase
        .from('sessions')
        .select('*')
        .eq('user_id', user_id)
        .gte('date', weekStartStr)
        .lte('date', weekEndStr)
        .order('date', { ascending: true }),
    ]);

    if (recentSessionsErr) console.warn('[coach-chat] recent sessions query error:', recentSessionsErr);
    if (recentStravaErr) console.warn('[coach-chat] recent strava query error:', recentStravaErr);
    if (thisWeekErr) console.warn('[coach-chat] this week sessions query error:', thisWeekErr);

    const hasAnyRecentData = (recentSessions?.length ?? 0) > 0 || (recentStrava?.length ?? 0) > 0;

    // Build "Last 4 weeks" summary from the bounded window only
    const summary = hasAnyRecentData
      ? buildTrainingSummaryUsingMerge(recentSessions ?? [], recentStrava ?? [])
      : 'No training data found in the last 28 days.';

    // Build "This week" from sessions table (matches schedule page)
    const thisWeekLines =
      (thisWeekSessions?.length ?? 0) > 0
        ? (thisWeekSessions as any[])
            .map((s) => `• ${s.date}: ${s.title}`)
            .join('\n')
        : 'No sessions found';

    const systemPrompt = `
You are a smart, helpful triathlon coach inside TrainGPT. Respond like a real coach: conversational, realistic, and honest. Focus on what matters most. Don’t sugarcoat poor consistency, but be constructive.

Avoid:
- repeating training data unless relevant
- filler phrases / fake hype

Important:
- "Last 4 weeks" means the last 28 days ending today (not the last 4 plan weeks).
- If data is missing or syncing looks broken, say so directly and focus on next best actions.

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

📅 This Week (starting ${weekStartStr})
${thisWeekLines}

📅 Last 4 Weeks (last 28 days ending ${todayStr}) — planned vs matched Strava
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
      return NextResponse.json(
        { error: 'Server misconfigured: missing OPENAI_API_KEY' },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: 'Coach chat failed' }, { status: 500 });
  }
}

function buildTrainingSummaryUsingMerge(sessions: any[], strava: any[]): string {
  const weeks: Record<string, { planned: any[]; matched: any[]; bucket: any[] }> = {};

  const weekOf = (dateStr: string) =>
    formatISO(startOfWeek(parseISO(dateStr), { weekStartsOn: 1 }), { representation: 'date' });

  for (const s of sessions) {
    if (!s?.date) continue;
    const week = weekOf(s.date);
    weeks[week] ??= { planned: [], matched: [], bucket: [] };
    weeks[week].planned.push(s);
  }

  for (const a of strava) {
    // Prefer local date for bucketing (what athletes expect)
    const dateISO =
      isoDateFromAnyDateLike(a.start_date_local) ??
      isoDateFromAnyDateLike(a.start_date);

    if (!dateISO) continue;

    const week = weekOf(dateISO);
    weeks[week] ??= { planned: [], matched: [], bucket: [] };
    weeks[week].bucket.push(a);
  }

  for (const [week, data] of Object.entries(weeks)) {
    if (!data.planned.length || !data.bucket.length) continue;
    const { merged } = mergeSessionsWithStrava(data.planned, data.bucket);
    data.matched = merged.filter((m: any) => !!m.stravaActivity);
  }

  return Object.entries(weeks)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([week, data]) => {
      const planned = data.planned.length;
      const done = data.matched.length;
      const pct = planned > 0 ? Math.round((done / planned) * 100) : 0;

      const plannedList = data.planned
        .slice(0, 6)
        .map((s: any) => s.title)
        .join(', ');

      const matchedList = data.matched
        .slice(0, 6)
        .map((m: any) => `${m.title} ✅`)
        .join(', ');

      return `- Week of ${week}: ${done}/${planned} completed (${pct}%)
  • Planned: ${plannedList || 'None'}
  • Completed (matched): ${matchedList || 'None'}`;
    })
    .join('\n\n');
}
