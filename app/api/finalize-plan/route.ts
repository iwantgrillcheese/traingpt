import { NextResponse, after } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import {
  parseISO,
  isValid as isValidDate,
  addWeeks,
  differenceInCalendarWeeks,
  startOfWeek,
  formatISO,
  isLeapYear,
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
import { convertPlanToSessions } from '@/utils/convertPlanToSessions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/* ---------- helpers ---------- */

function safeDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  if (m === 1 && d === 29 && !isLeapYear(date)) date.setDate(28);
  return formatISO(date, { representation: 'date' });
}

function buildPlanMeta(totalWeeks: number, startDateISO: string): WeekMeta[] {
  const weeks: WeekMeta[] = [];
  const start = startOfWeek(parseISO(startDateISO), { weekStartsOn: 1 });
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
      startDate: safeDateISO(weekStart),
      deload,
    });
  }
  return weeks;
}

function computeTotalWeeks(todayISO: string, raceDateISO: string): number {
  const start = startOfWeek(parseISO(todayISO), { weekStartsOn: 1 });
  const raceDate = parseISO(raceDateISO);
  const raceWeekStart = startOfWeek(raceDate, { weekStartsOn: 1 });

  let diff = differenceInCalendarWeeks(raceWeekStart, start, { weekStartsOn: 1 });
  if (raceDate > raceWeekStart) diff += 1;
  return Math.max(1, diff);
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
      preferencesText,
    } = body ?? {};

    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user)
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const userId = user.id;

// ✅ Validation (restDay now optional)
if (!raceType || !raceDate || !experience || !maxHours) {
  return NextResponse.json({ ok: false, error: 'Missing required fields' }, { status: 400 });
}

const raceISO = parseISO(raceDate);
if (!isValidDate(raceISO)) {
  return NextResponse.json({ ok: false, error: 'Invalid raceDate' }, { status: 400 });
}

// ✅ Default rest day fallback
const restDayResolved = restDay && restDay.trim() !== '' ? restDay : 'Monday';

const trainingPrefs = extractPrefs(preferencesText);

const userParams: UserParams = {
  raceType,
  raceDate,
  experience,
  maxHours: Number(maxHours),
  restDay: restDayResolved,
  bikeFtp: bikeFtp ?? undefined,
  runPace: runPace ?? undefined,
  swimPace: swimPace ?? undefined,
  trainingPrefs,
};


    // Compute meta now (light)
    const todayISO = safeDateISO(new Date());
    const totalWeeks = computeTotalWeeks(todayISO, raceDate);
    const planMeta = buildPlanMeta(totalWeeks, todayISO);
    const planTypeResolved: PlanType = planType ?? 'triathlon';

    // 🟢 Return immediately to user to avoid 60s timeout
    const response = NextResponse.json({
      ok: true,
      message: 'Plan generation started',
    });

    // 🧠 Generate plan in background
    after(async () => {
      console.log('[finalize-plan] background generation started');
      try {
        const weeks: WeekJson[] = await startPlan({
          planMeta,
          userParams,
          planType: planTypeResolved,
        });

        // Force taper + race day
        if (weeks.length > 0) weeks[weeks.length - 1].phase = 'Taper';
        const raceDay = safeDateISO(parseISO(raceDate));
        const lastWeek = weeks[weeks.length - 1];
        if (lastWeek) lastWeek.days[raceDay] = [`🏁 ${raceType} Race Day`];

        const generatedPlan: GeneratedPlan = {
          planType: planTypeResolved,
          weeks,
          params: userParams,
          createdAt: new Date().toISOString(),
        };

        // Upsert plan
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

        if (upsertErr) throw upsertErr;
        const planId = upserted?.id as string;

        // Clear + insert sessions (deduped)
        const { error: delErr } = await supabase
          .from('sessions')
          .delete()
          .eq('user_id', userId)
          .eq('plan_id', planId);
        if (delErr) console.error('[finalize-plan] delete sessions error', delErr);

        let sessionRows = convertPlanToSessions(userId, planId, generatedPlan);
        const seen = new Set<string>();
        sessionRows = sessionRows.filter((s) => {
          const key = `${s.date}-${s.sport}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        if (sessionRows.length > 0) {
          const { error: insErr } = await supabase.from('sessions').insert(sessionRows);
          if (insErr) console.error('[finalize-plan] insert sessions error', insErr);
        }

        // Welcome email
        try {
          await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/send-welcome-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, planId }),
          });
        } catch (emailErr) {
          console.error('[finalize-plan] welcome email error', emailErr);
        }

        console.log('[finalize-plan] background generation completed');
      } catch (err) {
        console.error('[finalize-plan] background generation failed', err);
      }
    });

    return response;
  } catch (err: any) {
    console.error('[finalize-plan] error', err);
    return NextResponse.json(
      { ok: false, error: 'Internal error', details: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
