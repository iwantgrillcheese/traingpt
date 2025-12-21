import { NextResponse } from 'next/server';
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

import type { UserParams, WeekMeta, PlanType, GeneratedPlan, WeekJson } from '@/types/plan';
import { extractPrefs } from '@/utils/extractPrefs';
import { startPlan } from '@/utils/start-plan';
import { convertPlanToSessions } from '@/utils/convertPlanToSessions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/* ---------- helpers ---------- */

function safeDateISO(date: Date): string {
  const m = date.getMonth();
  const d = date.getDate();
  // Guard against Feb 29 on non-leap years (extra safety)
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
  const startedAt = Date.now();
  // keep a little safety buffer under 300s so we don’t get killed mid-write
  const HARD_BUDGET_MS = 285_000;

  try {
    const body = await req.json();

    // ✅ Accept both bikeFtp (new) and bikeFTP (legacy UI)
    const {
      raceType,
      raceDate,
      experience,
      maxHours,
      restDay,
      bikeFtp,
      bikeFTP,
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

    if (userErr || !user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

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

    // ✅ Normalize FTP to a number if present (avoid strings like "250")
    const ftpRaw = bikeFtp ?? bikeFTP;
    const ftpNormalized =
      ftpRaw === null || ftpRaw === undefined || String(ftpRaw).trim() === ''
        ? undefined
        : Number(ftpRaw);

    const userParams: UserParams = {
      raceType,
      raceDate,
      experience,
      maxHours: Number(maxHours),
      restDay: restDayResolved,
      bikeFtp: Number.isFinite(ftpNormalized as number) ? (ftpNormalized as number) : undefined,
      runPace: runPace ?? undefined,
      swimPace: swimPace ?? undefined,
      trainingPrefs,
    };

    // Compute meta now (light)
    const todayISO = safeDateISO(new Date());
    const totalWeeks = computeTotalWeeks(todayISO, raceDate);
    const planMeta = buildPlanMeta(totalWeeks, todayISO);
    const planTypeResolved: PlanType = planType ?? 'triathlon';

    console.log('[finalize-plan] generation started', {
      userId,
      totalWeeks,
      planTypeResolved,
      raceType,
      raceDate,
    });

    // ✅ Generate weeks in-request (reliable). Add timing logs around it.
    const genStart = Date.now();
    const weeks: WeekJson[] = [];

    for (let i = 0; i < planMeta.length; i++) {
      const elapsed = Date.now() - startedAt;
      if (elapsed > HARD_BUDGET_MS) {
        throw new Error(
          `Plan generation exceeded time budget (${Math.round(elapsed / 1000)}s).`
        );
      }

      const w0 = Date.now();
      // startPlan() does guardWeek + generateWeek; but we want per-week logs.
      // If you prefer not to duplicate logic, you can move this loop into startPlan
      // and keep logs there. For now, inline for visibility.
      // We'll call startPlan for the remaining in one shot if you prefer later.
      const singleWeek = await (async () => {
        const { generateWeek } = await import('@/utils/generate-week');
        const { guardWeek } = await import('@/utils/planGuard');
        const raw: WeekJson = await generateWeek({
          weekMeta: planMeta[i],
          userParams,
          planType: planTypeResolved,
          index: i,
        });
        return guardWeek(raw, userParams.trainingPrefs);
      })();

      weeks.push(singleWeek);

      const w1 = Date.now();
      console.log('[finalize-plan] week generated', {
        weekIndex: i,
        weekLabel: planMeta[i]?.label,
        phase: planMeta[i]?.phase,
        ms: w1 - w0,
        elapsedSec: Math.round((w1 - startedAt) / 1000),
      });
    }

    console.log('[finalize-plan] all weeks generated', {
      ms: Date.now() - genStart,
      elapsedSec: Math.round((Date.now() - startedAt) / 1000),
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

    // Clear existing sessions for this plan
    const { error: delErr } = await supabase
      .from('sessions')
      .delete()
      .eq('user_id', userId)
      .eq('plan_id', planId);

    if (delErr) console.error('[finalize-plan] delete sessions error', delErr);

    // Convert → session rows (date-safe)
    let sessionRows = convertPlanToSessions(userId, planId, generatedPlan);

    // ✅ Deduplicate without dropping legit doubles
    const seen = new Set<string>();
    sessionRows = sessionRows.filter((s) => {
      const key = `${s.date}-${s.sport}-${s.title ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (sessionRows.length > 0) {
      const { error: insErr } = await supabase.from('sessions').insert(sessionRows);
      if (insErr) {
        console.error('[finalize-plan] insert sessions error', insErr);
        console.error('[finalize-plan] insert sessions rows sample', sessionRows.slice(0, 3));
      }
    }

    // Welcome email (do not fail request if this fails)
    try {
      const url = new URL(req.url);
      const origin =
        process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
        `${req.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')}://${
          req.headers.get('x-forwarded-host') ?? url.host
        }`;

      await fetch(`${origin}/api/send-welcome-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, planId }),
      });
    } catch (emailErr) {
      console.error('[finalize-plan] welcome email error', emailErr);
    }

    console.log('[finalize-plan] completed', {
      userId,
      planId,
      elapsedSec: Math.round((Date.now() - startedAt) / 1000),
    });

    return NextResponse.json({
      ok: true,
      planId,
      plan: generatedPlan,
    });
  } catch (err: any) {
    console.error('[finalize-plan] error', err);
    return NextResponse.json(
      { ok: false, error: 'Internal error', details: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
