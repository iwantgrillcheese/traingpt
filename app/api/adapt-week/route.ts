// /app/api/adapt-week/route.ts
//
// Adaptive Week v1 cron. Runs Sunday 20:00 UTC — one hour BEFORE the weekly
// upcoming-week email — so the email can carry the adaptation summary.
//
// For every active plan (race date today or later):
//   1. Identify the week that just ended (Mon–Sun containing "today" in the
//      reference timezone) and the week about to start.
//   2. Determine what was actually completed: sessions.status === 'done',
//      manual completed_sessions rows, or a Strava activity match via the
//      same mergeSessionsWithStrava used by the web app.
//   3. Run the deterministic adaptNextWeek rules engine on next week.
//   4. Persist: plan JSON, sessions rows (duration/title/details), and a
//      plan_adaptations row with the diff + plain-language summary.
//
// Testing: ?dry=1 computes and returns everything without writing;
// ?user=<uuid> restricts the run to one user.

import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import mergeSessionsWithStrava from '@/utils/mergeSessionWithStrava';
import { adaptNextWeek, type AdaptationInputs, type StructuredPlanSession } from '@/utils/adaptNextWeek';
import type { GeneratedPlan, WeekJson } from '@/types/plan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type PlanRow = {
  id: string;
  user_id: string;
  race_date: string | null;
  plan: GeneratedPlan | null;
};

type DbSessionRow = {
  id: string;
  date: string;
  sport: string | null;
  title: string | null;
  session_title?: string | null;
  duration: number | null;
  status: string | null;
  raw: any;
};

function isAuthorizedCronRequest(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return true;

  const authHeader = req.headers.get('authorization') ?? '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const querySecret = req.nextUrl.searchParams.get('secret') ?? '';

  return bearerToken === cronSecret || querySecret === cronSecret;
}

/** Monday (ISO date) of the week containing "now" in the reference timezone. */
function referenceWeekStart(now = new Date()) {
  const tz = process.env.DAILY_EMAIL_TIMEZONE || 'America/Los_Angeles';
  const todayISO = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

  const anchor = new Date(`${todayISO}T12:00:00Z`);
  const jsDay = anchor.getUTCDay(); // 0 = Sunday
  const offset = jsDay === 0 ? -6 : 1 - jsDay;
  anchor.setUTCDate(anchor.getUTCDate() + offset);
  return anchor.toISOString().slice(0, 10);
}

function addDaysISO(iso: string, days: number) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isCountableSport(sport: string | null | undefined) {
  const value = String(sport ?? '').toLowerCase();
  return value === 'swim' || value === 'bike' || value === 'run' || value === 'strength';
}

function isAnchorRow(row: DbSessionRow) {
  const priority = String(row.raw?.priority ?? '').toLowerCase();
  if (priority === 'anchor') return true;
  return /^(long ride|long run)$/i.test(String(row.title ?? '').trim());
}

function weekDates(week: WeekJson): string[] {
  const start = String(week.startDate ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return [];
  return Array.from({ length: 7 }, (_, index) => addDaysISO(start, index));
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { success: false, error: 'SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured' },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const dryRun = req.nextUrl.searchParams.get('dry') === '1';
  const onlyUser = req.nextUrl.searchParams.get('user');

  const endedWeekStart = referenceWeekStart();
  const endedWeekEnd = addDaysISO(endedWeekStart, 6);
  const todayISO = new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.DAILY_EMAIL_TIMEZONE || 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  let plansQuery = supabase
    .from('plans')
    .select('id, user_id, race_date, plan')
    .gte('race_date', todayISO)
    .order('created_at', { ascending: false });

  if (onlyUser) plansQuery = plansQuery.eq('user_id', onlyUser);

  const { data: planRows, error: plansError } = await plansQuery;

  if (plansError) {
    console.error('[adapt-week] error fetching plans:', plansError);
    return NextResponse.json({ success: false, error: plansError.message }, { status: 500 });
  }

  // Latest plan per user only.
  const latestByUser = new Map<string, PlanRow>();
  for (const row of (planRows ?? []) as PlanRow[]) {
    if (!latestByUser.has(row.user_id)) latestByUser.set(row.user_id, row);
  }

  const results: Array<Record<string, unknown>> = [];
  let adapted = 0;
  let unchanged = 0;
  let skipped = 0;
  const errors: Array<{ planId: string; error: string }> = [];

  for (const planRow of latestByUser.values()) {
    try {
      const plan = planRow.plan;
      const weeks = Array.isArray(plan?.weeks) ? (plan!.weeks as WeekJson[]) : [];

      if (!plan || plan.planType !== 'triathlon' || !weeks.length) {
        skipped += 1;
        continue;
      }

      const endedIndex = weeks.findIndex((week) => String(week?.startDate ?? '') === endedWeekStart);
      const nextIndex = endedIndex + 1;

      if (endedIndex < 0 || nextIndex >= weeks.length) {
        skipped += 1;
        continue;
      }

      const nextWeek = weeks[nextIndex];

      // ---- Gather what actually happened in the ended week ----
      const [{ data: sessionRows }, { data: completedRows }, { data: stravaRows }] = await Promise.all([
        supabase
          .from('sessions')
          .select('id, date, sport, title, session_title, duration, status, raw')
          .eq('user_id', planRow.user_id)
          .eq('plan_id', planRow.id)
          .gte('date', endedWeekStart)
          .lte('date', endedWeekEnd),
        supabase
          .from('completed_sessions')
          .select('date, session_title, status')
          .eq('user_id', planRow.user_id)
          .gte('date', endedWeekStart)
          .lte('date', endedWeekEnd),
        supabase
          .from('strava_activities')
          .select('id, strava_id, sport_type, start_date, start_date_local, moving_time, distance, name')
          .eq('user_id', planRow.user_id)
          .gte('start_date', `${endedWeekStart}T00:00:00`)
          .lte('start_date', `${endedWeekEnd}T23:59:59`),
      ]);

      const planned = ((sessionRows ?? []) as DbSessionRow[]).filter((row) => isCountableSport(row.sport));

      // completed_sessions stores both 'done' and 'skipped' rows — a skipped
      // session must never count as completed work.
      const completedKeys = new Set(
        ((completedRows ?? []) as Array<{ date: string | null; session_title: string | null; status?: string | null }>)
          .filter((row) => String(row.status ?? 'done').toLowerCase() !== 'skipped')
          .map((row) => `${row.date}::${String(row.session_title ?? '').trim().toLowerCase()}`)
      );

      const { merged } = mergeSessionsWithStrava(planned as any[], (stravaRows ?? []) as any[]);
      const stravaMatchedIds = new Set(
        merged.filter((session: any) => session?.stravaActivity).map((session: any) => String(session.id))
      );

      const isCompleted = (row: DbSessionRow) =>
        String(row.status ?? '').toLowerCase() === 'done' ||
        completedKeys.has(`${row.date}::${String(row.title ?? row.session_title ?? '').trim().toLowerCase()}`) ||
        stravaMatchedIds.has(String(row.id));

      const completedCount = planned.filter(isCompleted).length;
      const plannedCount = planned.length;
      const complianceRatio = plannedCount > 0 ? completedCount / plannedCount : 1;

      const missedAnchors = planned
        .filter((row) => isAnchorRow(row) && !isCompleted(row))
        .map((row) => ({
          title: String(row.title ?? 'Long Ride'),
          durationMinutes: typeof row.duration === 'number' ? row.duration : Number(row.raw?.durationMinutes ?? 0) || null,
        }));

      const raceDate = String(planRow.race_date ?? plan.params?.raceDate ?? '');
      const nextWeekIsRaceWeek = weekDates(nextWeek).includes(raceDate);

      const inputs: AdaptationInputs = {
        plannedCount,
        completedCount,
        complianceRatio,
        missedAnchors,
        nextWeekIsRaceWeek,
        nextWeekDeload: Boolean(nextWeek.deload),
      };

      const { week: adaptedWeek, changes, summary } = adaptNextWeek({ nextWeek, inputs });

      results.push({
        planId: planRow.id,
        userId: planRow.user_id,
        compliance: Math.round(complianceRatio * 100),
        plannedCount,
        completedCount,
        missedAnchors: missedAnchors.map((anchor) => anchor.title),
        changes,
        summary,
      });

      if (dryRun) continue;

      // ---- Persist ----
      if (changes.length) {
        weeks[nextIndex] = adaptedWeek;
        plan.weeks = weeks;

        if (plan.days && typeof plan.days === 'object') {
          for (const [date, items] of Object.entries(adaptedWeek.days ?? {})) {
            (plan.days as Record<string, unknown[]>)[date] = items as unknown[];
          }
        }

        const { error: planSaveError } = await supabase
          .from('plans')
          .update({ plan })
          .eq('id', planRow.id)
          .eq('user_id', planRow.user_id);

        if (planSaveError) throw planSaveError;

        // Mirror onto sessions rows: match by date + sport, disambiguate by
        // pre-adaptation title (changes carry from/to titles).
        for (const change of changes) {
          const originalTitle = change.change === 'downgraded_intensity' ? change.from : change.title;

          const { data: rows } = await supabase
            .from('sessions')
            .select('id, title')
            .eq('user_id', planRow.user_id)
            .eq('plan_id', planRow.id)
            .eq('date', change.date)
            .eq('sport', change.sport.toLowerCase());

          const candidates = Array.isArray(rows) ? rows : [];
          const target =
            candidates.length === 1
              ? candidates[0]
              : candidates.find(
                  (row) => String(row.title ?? '').trim().toLowerCase() === originalTitle.trim().toLowerCase()
                );

          if (!target?.id) continue;

          // Pull the adapted session back out of the adapted week for details/duration.
          const adaptedItems = (adaptedWeek.days?.[change.date] ?? []) as StructuredPlanSession[];
          const adaptedSession = adaptedItems.find(
            (item) =>
              String(item?.sport ?? '').toLowerCase() === change.sport.toLowerCase() &&
              String(item?.title ?? '').trim().toLowerCase() === change.title.trim().toLowerCase()
          );

          if (!adaptedSession) continue;

          await supabase
            .from('sessions')
            .update({
              title: String(adaptedSession.title ?? change.title),
              session_title: String(adaptedSession.title ?? change.title),
              duration:
                typeof adaptedSession.durationMinutes === 'number' ? adaptedSession.durationMinutes : undefined,
              details: typeof adaptedSession.details === 'string' ? adaptedSession.details : undefined,
              raw: adaptedSession,
            })
            .eq('id', target.id);
        }

        adapted += 1;
      } else {
        unchanged += 1;
      }

      // Always record the adaptation (even "no changes") so the weekly email
      // has a personalized coach line for every athlete.
      const { error: adaptationSaveError } = await supabase.from('plan_adaptations').upsert(
        {
          user_id: planRow.user_id,
          plan_id: planRow.id,
          week_index: nextIndex,
          week_start: addDaysISO(endedWeekStart, 7),
          compliance: Math.round(complianceRatio * 100),
          changes,
          summary,
        },
        { onConflict: 'plan_id,week_index' }
      );

      if (adaptationSaveError) throw adaptationSaveError;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[adapt-week] failed for plan ${planRow.id}:`, error);
      errors.push({ planId: planRow.id, error: message });
    }
  }

  return NextResponse.json({
    success: true,
    endedWeek: { start: endedWeekStart, end: endedWeekEnd },
    plansChecked: latestByUser.size,
    adapted,
    unchanged,
    skipped,
    dryRun,
    results: dryRun || onlyUser ? results : undefined,
    errors,
  });
}
