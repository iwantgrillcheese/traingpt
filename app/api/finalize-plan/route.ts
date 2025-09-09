// /app/api/finalize-plan/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  parseISO,
  isValid as isValidDate,
  addWeeks,
  differenceInCalendarWeeks,
  startOfWeek,
  formatISO,
} from 'date-fns';

import type {
  UserParams,
  WeekMeta,
  PlanType,
  GeneratedPlan,
  WeekJson,
} from '@/types/plan';
import { extractPrefs } from '@/utils/extractPrefs';
import { startPlan } from '@/utils/start-plan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ---------- helpers: week meta + flatten sessions ---------- */

function buildPlanMeta(totalWeeks: number, startDateISO: string): WeekMeta[] {
  const weeks: WeekMeta[] = [];
  const start = startOfWeek(parseISO(startDateISO), { weekStartsOn: 1 }); // Monday
  const peakWeeks = Math.min(2, Math.max(0, totalWeeks >= 10 ? 2 : totalWeeks >= 8 ? 1 : 0));
  const taperWeeks = Math.min(2, Math.max(1, totalWeeks >= 10 ? 2 : 1));
  const remaining = Math.max(0, totalWeeks - (peakWeeks + taperWeeks));
  const baseWeeks = Math.max(1, Math.round(remaining * 0.5));
  const buildWeeks = Math.max(0, remaining - baseWeeks);

  const phases: Array<'Base' | 'Build' | 'Peak' | 'Taper'> = [];
  for (let i = 0; i < baseWeeks; i++) phases.push('Base');
  for (let i = 0; i < buildWeeks; i++) phases.push('Build');
  for (let i = 0; i < peakWeeks; i++) phases.push('Peak');
  for (let i = 0; i < taperWeeks; i++) phases.push('Taper');

  for (let i = 0; i < totalWeeks; i++) {
    const weekStart = addWeeks(start, i);
    const phase = phases[i] ?? 'Base';
    const deload = (phase === 'Base' || phase === 'Build') && i > 0 && (i + 1) % 4 === 0;

    weeks.push({
      label: `Week ${i + 1}`,
      phase,
      startDate: formatISO(weekStart, { representation: 'date' }),
      deload,
    });
  }
  return weeks;
}

function computeTotalWeeks(todayISO: string, raceDateISO: string): number {
  const start = startOfWeek(parseISO(todayISO), { weekStartsOn: 1 });
  const race = startOfWeek(parseISO(raceDateISO), { weekStartsOn: 1 });
  const diff = differenceInCalendarWeeks(race, start, { weekStartsOn: 1 });
  return Math.max(1, diff);
}

/** Flatten weeks.days → [{date,title,description,sequence}] */
function flattenSessions(weeks: WeekJson[]) {
  type Flat = { date: string; title: string; description: string; sequence: number };
  const flat: Flat[] = [];
  for (const w of weeks) {
    const entries = Object.entries(w.days).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    for (const [date, items] of entries) {
      items.forEach((raw, idx) => {
        // Normalize: split "Title — Description"
        const [titlePart, ...descParts] = String(raw).split(' — ');
        const title = titlePart?.trim() || 'Workout';
        const description = descParts.join(' — ').trim() || 'Details';
        flat.push({ date, title, description, sequence: idx });
      });
    }
  }
  return flat;
}

/* ----------------------------- route ----------------------------- */

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const {
      raceType,
      raceDate,
      experience,
      maxHours,
      restDay,
      bikeFtp,
      runPace,
      swimPace,
      planType,
      preferencesText, // optional free-form
    } = body ?? {};

    const supabase = createServerComponentClient({ cookies });
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = user.id;

    // Basic validation
    if (!raceType || !raceDate || !experience || !maxHours || !restDay) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    const raceISO = parseISO(raceDate);
    if (!isValidDate(raceISO)) {
      return NextResponse.json({ error: 'Invalid raceDate' }, { status: 400 });
    }

    // Extract preferences (undefined if none provided) → defaults downstream
    const trainingPrefs = extractPrefs(preferencesText);

    const userParams: UserParams = {
      raceType,
      raceDate,
      experience,
      maxHours: Number(maxHours),
      restDay,
      bikeFtp: bikeFtp ?? undefined,
      runPace: runPace ?? undefined,
      swimPace: swimPace ?? undefined,
      trainingPrefs, // may be undefined
    };

    // Build plan meta & generate
    const todayISO = formatISO(new Date(), { representation: 'date' });
    const totalWeeks = computeTotalWeeks(todayISO, raceDate);
    const planMeta: WeekMeta[] = buildPlanMeta(totalWeeks, todayISO);
    const planTypeResolved: PlanType = planType ?? 'triathlon';

    let weeks: WeekJson[];
    try {
      weeks = await startPlan({
        planMeta,
        userParams,
        planType: planTypeResolved,
      });
    } catch (err) {
      console.error('[finalize-plan] startPlan error', err);
      return NextResponse.json(
        { error: 'Failed to generate plan', details: String(err) },
        { status: 500 }
      );
    }

    const generatedPlan: GeneratedPlan = {
      planType: planTypeResolved,
      weeks,
      params: userParams,
      createdAt: new Date().toISOString(),
    };

    // One plan per user: upsert by user_id; return id
    const { data: upserted, error: upsertErr } = await supabase
      .from('plans')
      .upsert(
        {
          user_id: userId,
          race_date: raceDate,
          race_type: raceType,
          plan: generatedPlan,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select('id')
      .single();

    if (upsertErr) {
      console.error('[finalize-plan] upsert error', upsertErr);
      return NextResponse.json(
        { error: 'Failed to save plan', details: upsertErr.message },
        { status: 500 }
      );
    }
    const planId = upserted?.id as string;

    // Explode into sessions:
    const sessionRows = flattenSessions(weeks).map((s) => ({
      user_id: userId,
      plan_id: planId,
      session_date: s.date,     // date (YYYY-MM-DD)
      title: s.title,           // text
      description: s.description, // text
      sequence: s.sequence,     // int per day ordering
    }));

    // Clear old sessions for this user/plan (idempotent)
    const { error: delErr } = await supabase
      .from('sessions')
      .delete()
      .eq('user_id', userId)
      .eq('plan_id', planId);

    if (delErr) {
      console.error('[finalize-plan] sessions delete error', delErr);
      // not fatal — we can still try to insert; but warn
    }

    if (sessionRows.length > 0) {
      const { error: insErr } = await supabase.from('sessions').insert(sessionRows);
      if (insErr) {
        console.error('[finalize-plan] sessions insert error', insErr);
        // Return OK but indicate sessions failed (UI can still show JSON plan)
        return NextResponse.json(
          {
            plan: generatedPlan,
            warning: 'Plan saved but sessions not populated',
            details: insErr.message,
          },
          { status: 200 }
        );
      }
    }

    return NextResponse.json({ plan: generatedPlan }, { status: 200 });
  } catch (err: any) {
    console.error('[finalize-plan] error', err);
    return NextResponse.json(
      { error: 'Internal error', details: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
