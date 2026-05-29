import { NextResponse } from "next/server";
import {
  parseISO,
  isValid as isValidDate,
  addWeeks,
  differenceInCalendarWeeks,
  startOfWeek,
  formatISO,
  isLeapYear,
} from "date-fns";

import type { UserParams, WeekMeta, PlanType, GeneratedPlan, WeekJson } from "@/types/plan";
import { extractPrefs } from "@/utils/extractPrefs";
import { convertPlanToSessions } from "@/utils/convertPlanToSessions";
import { validateGeneratedPlan } from "@/utils/validateGeneratedPlan";
import { repairGeneratedPlan } from "@/utils/repairGeneratedPlan";
import { AuthError, assertSameUser, createRouteSupabaseClient, requireUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/* ---------- helpers ---------- */

function safeDateISO(date: Date): string {
  const m = date.getMonth();
  const d = date.getDate();
  if (m === 1 && d === 29 && !isLeapYear(date)) date.setDate(28);
  return formatISO(date, { representation: "date" });
}

function buildPlanMeta(totalWeeks: number, startDateISO: string): WeekMeta[] {
  const weeks: WeekMeta[] = [];
  const start = startOfWeek(parseISO(startDateISO), { weekStartsOn: 1 });

  const peakWeeks = Math.min(2, Math.max(0, totalWeeks >= 10 ? 2 : totalWeeks >= 8 ? 1 : 0));
  const taperWeeks = Math.min(2, Math.max(1, totalWeeks >= 10 ? 2 : 1));
  const remaining = Math.max(0, totalWeeks - (peakWeeks + taperWeeks));
  const baseWeeks = Math.max(1, Math.round(remaining * 0.5));
  const buildWeeks = Math.max(0, remaining - baseWeeks);

  const phases: Array<"Base" | "Build" | "Peak" | "Taper"> = [];
  for (let i = 0; i < baseWeeks; i++) phases.push("Base");
  for (let i = 0; i < buildWeeks; i++) phases.push("Build");
  for (let i = 0; i < peakWeeks; i++) phases.push("Peak");
  for (let i = 0; i < taperWeeks; i++) phases.push("Taper");

  for (let i = 0; i < totalWeeks; i++) {
    const weekStart = addWeeks(start, i);
    const phase = phases[i] ?? "Base";
    const deload = (phase === "Base" || phase === "Build") && i > 0 && (i + 1) % 4 === 0;

    weeks.push({
      label: `Week ${i + 1}`,
      phase,
      startDate: safeDateISO(weekStart),
      deload,
    });
  }

  return weeks;
}


function secondsToHMM(totalSec: number): string {
  const safe = Number.isFinite(totalSec) ? Math.max(0, Math.floor(totalSec)) : 0;
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function secondsToPacePerKm(totalSecPerKm: number): string {
  if (!Number.isFinite(totalSecPerKm) || totalSecPerKm <= 0) return "unknown";
  const total = Math.round(totalSecPerKm);
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${min}:${String(sec).padStart(2, "0")} / km`;
}

type StravaHistoryRow = {
  sport_type: string | null;
  moving_time: number | null;
  distance: number | null;
  start_date: string | null;
  average_heartrate?: number | null;
  max_heartrate?: number | null;
  weighted_average_watts?: number | null;
  average_watts?: number | null;
  average_speed?: number | null;
};

function computeStravaBaselines(rows: StravaHistoryRow[]) {
  const runCandidates = rows.filter((r) => {
    const sport = String(r.sport_type ?? "").toLowerCase();
    return sport === "run" && (r.moving_time ?? 0) >= 20 * 60;
  });

  const bikeCandidates = rows.filter((r) => {
    const sport = String(r.sport_type ?? "").toLowerCase();
    return sport === "bike" && (r.moving_time ?? 0) >= 30 * 60;
  });

  const runHrValues = runCandidates
    .map((r) => r.average_heartrate)
    .filter((v): v is number => Number.isFinite(v ?? Number.NaN));

  const runSpeedValues = runCandidates
    .map((r) => r.average_speed)
    .filter((v): v is number => Number.isFinite(v ?? Number.NaN) && (v ?? 0) > 0);

  const bikePowerValues = bikeCandidates
    .map((r) => (r.weighted_average_watts ?? r.average_watts ?? null))
    .filter((v): v is number => Number.isFinite(v ?? Number.NaN) && (v ?? 0) > 0);

  const estimatedLthr = runHrValues.length
    ? Math.round(runHrValues.slice().sort((a, b) => b - a)[Math.floor(runHrValues.length * 0.15)] ?? runHrValues[0])
    : null;

  const bestBikePower = bikePowerValues.length ? Math.max(...bikePowerValues) : null;
  const estimatedFtp = bestBikePower ? Math.round(bestBikePower * 0.95) : null;

  const bestRunSpeed = runSpeedValues.length ? Math.max(...runSpeedValues) : null;
  const estimatedRunThresholdPacePerKm = bestRunSpeed ? secondsToPacePerKm(1000 / bestRunSpeed) : null;

  return {
    estimatedLthr,
    estimatedFtp,
    estimatedRunThresholdPacePerKm,
  };
}

function buildStravaHistorySummary(
  rows: StravaHistoryRow[]
): string {
  if (!rows.length) return '';

  const baselines = computeStravaBaselines(rows);

  const totalSec = rows.reduce((acc, row) => acc + (row.moving_time ?? 0), 0);
  const totalDistanceKm = rows.reduce((acc, row) => acc + ((row.distance ?? 0) / 1000), 0);

  const bySport = new Map<string, { sessions: number; sec: number }>();
  for (const row of rows) {
    const sport = row.sport_type || 'Other';
    const entry = bySport.get(sport) ?? { sessions: 0, sec: 0 };
    entry.sessions += 1;
    entry.sec += row.moving_time ?? 0;
    bySport.set(sport, entry);
  }

  const topSports = Array.from(bySport.entries())
    .sort((a, b) => b[1].sec - a[1].sec)
    .slice(0, 4);

  const sportSummaryParts = topSports.map(
    ([sport, data]) => `${sport}: ${data.sessions} sessions, ${secondsToHMM(data.sec)}`
  );

  const sportLines = sportSummaryParts.join(' | ');

  const recent = [...rows]
    .filter((row) => !!row.start_date)
    .sort((a, b) => new Date(b.start_date as string).getTime() - new Date(a.start_date as string).getTime())
    .slice(0, 5)
    .map((row) => {
      const date = String(row.start_date).slice(0, 10);
      const distanceKm = row.distance ? (row.distance / 1000).toFixed(1) : null;
      const time = secondsToHMM(row.moving_time ?? 0);
      return `${date} ${row.sport_type ?? 'Other'} ${time}${distanceKm ? `, ${distanceKm}km` : ''}`;
    })
    .join(' ; ');

  return [
    `Last 365 days: ${rows.length} activities, ${secondsToHMM(totalSec)} total, ${totalDistanceKm.toFixed(1)}km total distance.`,
    sportLines ? `Sport split: ${sportLines}.` : '',
    `Estimated baselines: LTHR ${baselines.estimatedLthr ? `~${baselines.estimatedLthr} bpm` : 'unknown'}, FTP ${baselines.estimatedFtp ? `~${baselines.estimatedFtp}w` : 'unknown'}, threshold run pace ${baselines.estimatedRunThresholdPacePerKm ?? 'unknown'}.`,
    recent ? `Recent sessions: ${recent}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

function defaultRaceDateISO(raceType: string): string {
  const weeksByRace: Record<string, number> = {
    Sprint: 12,
    Olympic: 16,
    'Half Ironman (70.3)': 20,
    'Ironman (140.6)': 28,
  };

  const weeks = weeksByRace[raceType] ?? 16;
  const d = new Date();
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

function inferAbilityFromStrava(
  rows: Array<{ moving_time: number | null }>
): { experience: 'Beginner' | 'Intermediate' | 'Advanced'; maxHours: number } {
  const totalHours = rows.reduce((acc, row) => acc + ((row.moving_time ?? 0) / 3600), 0);
  const avgWeeklyHours = totalHours / 13;

  if (avgWeeklyHours >= 9) {
    return { experience: 'Advanced', maxHours: Math.min(16, Math.max(10, Math.round(avgWeeklyHours + 2))) };
  }

  if (avgWeeklyHours >= 5) {
    return { experience: 'Intermediate', maxHours: Math.min(12, Math.max(7, Math.round(avgWeeklyHours + 1))) };
  }

  return { experience: 'Beginner', maxHours: Math.max(5, Math.round(Math.max(avgWeeklyHours, 3))) };
}

function computeTotalWeeks(todayISO: string, raceDateISO: string): number {
  const start = startOfWeek(parseISO(todayISO), { weekStartsOn: 1 });
  const raceDate = parseISO(raceDateISO);
  const raceWeekStart = startOfWeek(raceDate, { weekStartsOn: 1 });

  let diff = differenceInCalendarWeeks(raceWeekStart, start, { weekStartsOn: 1 });
  if (raceDate > raceWeekStart) diff += 1;
  return Math.max(1, diff);
}


const DAY_TO_INDEX: Record<string, 0 | 1 | 2 | 3 | 4 | 5 | 6> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function normalizeDayName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim();
  if (!cleaned) return undefined;
  const key = cleaned.toLowerCase();
  if (!(key in DAY_TO_INDEX)) return undefined;
  return cleaned[0].toUpperCase() + cleaned.slice(1).toLowerCase();
}

function dayIndex(value: unknown): 0 | 1 | 2 | 3 | 4 | 5 | 6 | undefined {
  const normalized = normalizeDayName(value);
  if (!normalized) return undefined;
  return DAY_TO_INDEX[normalized.toLowerCase()];
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function buildConstraintsSummary({
  preferredLongRideDay,
  preferredLongRunDay,
  unavailableDays,
  swimComfort,
  twoADaysAllowed,
  athleteNotes,
  coachingPriorities,
}: {
  preferredLongRideDay?: string;
  preferredLongRunDay?: string;
  unavailableDays: string[];
  swimComfort?: string;
  twoADaysAllowed?: boolean;
  athleteNotes?: string;
  coachingPriorities: string[];
}) {
  const lines: string[] = [];
  if (preferredLongRideDay) lines.push(`Long rides should usually land on ${preferredLongRideDay}.`);
  if (preferredLongRunDay) lines.push(`Long runs should usually land on ${preferredLongRunDay}.`);
  if (unavailableDays.length) lines.push(`Avoid scheduling training on: ${unavailableDays.join(", ")}.`);
  if (swimComfort) lines.push(`Swim comfort is ${swimComfort}; adjust early swim progression accordingly.`);
  if (typeof twoADaysAllowed === "boolean") lines.push(`Two-a-days allowed: ${twoADaysAllowed ? "yes" : "no"}.`);
  if (coachingPriorities.length) lines.push(`Priorities: ${coachingPriorities.join(", ")}.`);
  if (athleteNotes?.trim()) lines.push(`Athlete notes: ${athleteNotes.trim()}`);
  return lines.join(" ");
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeWeekDays(value: unknown): Record<string, any[]> {
  if (!isPlainRecord(value)) return {};

  return Object.fromEntries(
    Object.entries(value).map(([key, items]) => [
      String(key),
      Array.isArray(items) ? items.filter((item) => typeof item === "string" || isPlainRecord(item)) : [],
    ])
  );
}

function normalizeGeneratedWeek(raw: unknown, meta: WeekMeta): WeekJson {
  const source = isPlainRecord(raw) ? raw : {};
  const rawStartDate = typeof source.startDate === "string" ? source.startDate : "";
  const parsedStartDate = rawStartDate ? parseISO(rawStartDate) : null;

  return {
    label: typeof source.label === "string" && source.label.trim() ? source.label : meta.label,
    phase: typeof source.phase === "string" && source.phase.trim() ? source.phase : meta.phase,
    startDate: parsedStartDate && isValidDate(parsedStartDate) ? rawStartDate : meta.startDate,
    deload: typeof source.deload === "boolean" ? source.deload : meta.deload,
    days: normalizeWeekDays(source.days) as Record<string, string[]>,
    debug: typeof source.debug === "string" ? source.debug : undefined,
  };
}

/* ----------------------------- route ----------------------------- */

export async function POST(req: Request) {
  const startedAt = Date.now();
  const HARD_BUDGET_MS = 285_000;

  try {
    const body = await req.json();

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
      preferredLongRideDay,
      preferredLongRunDay,
      unavailableDays,
      swimComfort,
      twoADaysAllowed,
      athleteNotes,
      coachingPriorities,
      paceUnit,
      clientUserId,
    } = body ?? {};

    const supabase = await createRouteSupabaseClient();
    const user = await requireUser(supabase);
    const userId = user.id;

    if (typeof clientUserId !== 'string' || !clientUserId) {
      console.error('[finalize-plan] missing client user id', { cookieUserId: userId });
      return NextResponse.json(
        {
          ok: false,
          error: 'Auth handshake missing. Refresh the app and try again.',
        },
        { status: 401 }
      );
    }

    assertSameUser({
      authenticatedUserId: userId,
      requestedUserId: clientUserId,
      routeName: 'finalize-plan',
    });

    const { data: latestPlanRow } = await supabase
      .from("plans")
      .select("race_date,race_type,plan")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const latestPlanParams = (latestPlanRow?.plan as any)?.params ?? null;

    if (!raceType) {
      return NextResponse.json({ ok: false, error: "Missing race type" }, { status: 400 });
    }

    const preferredLongRideDayResolved = normalizeDayName(preferredLongRideDay);
    const preferredLongRunDayResolved = normalizeDayName(preferredLongRunDay);
    const unavailableDaysResolved = normalizeStringArray(unavailableDays)
      .map(normalizeDayName)
      .filter((day): day is string => !!day);
    const athleteNotesResolved = typeof athleteNotes === "string" ? athleteNotes.trim() : "";
    const swimComfortResolved = typeof swimComfort === "string" && swimComfort.trim() ? swimComfort.trim() : undefined;
    const coachingPrioritiesResolved = normalizeStringArray(coachingPriorities);
    const twoADaysAllowedResolved = typeof twoADaysAllowed === "boolean" ? twoADaysAllowed : undefined;

    const constraintsSummary = buildConstraintsSummary({
      preferredLongRideDay: preferredLongRideDayResolved,
      preferredLongRunDay: preferredLongRunDayResolved,
      unavailableDays: unavailableDaysResolved,
      swimComfort: swimComfortResolved,
      twoADaysAllowed: twoADaysAllowedResolved,
      athleteNotes: athleteNotesResolved,
      coachingPriorities: coachingPrioritiesResolved,
    });

    const preferenceTextParts = [preferencesText, constraintsSummary].filter(Boolean).join("\n");
    const trainingPrefs: NonNullable<UserParams["trainingPrefs"]> = extractPrefs(preferenceTextParts) ?? {};
    const longRideIdx = dayIndex(preferredLongRideDayResolved);
    const longRunIdx = dayIndex(preferredLongRunDayResolved);
    if (longRideIdx !== undefined) {
      trainingPrefs.longRideDay = longRideIdx;
      trainingPrefs.brickDays = [longRideIdx];
    }
    if (longRunIdx !== undefined) {
      trainingPrefs.longRunDay = longRunIdx;
    }

    const ftpRaw = bikeFtp ?? bikeFTP;
    const ftpNormalized =
      ftpRaw === null || ftpRaw === undefined || String(ftpRaw).trim() === ""
        ? undefined
        : Number(ftpRaw);

    const paceUnitResolved: "mi" | "km" | undefined =
      paceUnit === "km" || paceUnit === "mi" ? paceUnit : undefined;

    const planTypeResolved: PlanType = planType ?? "triathlon";

    // Strava-based auto-calibration intentionally disabled for now (manual inputs only).
    const inferredBaselines = {
      estimatedFtp: null as number | null,
      estimatedRunThresholdPacePerKm: null as string | null,
    };

    const raceDateResolved = (() => {
      const raw = typeof raceDate === 'string' ? raceDate.trim() : '';
      if (raw) {
        const parsed = parseISO(raw);
        if (isValidDate(parsed)) return raw;
      }

      const latestRaceDate =
        typeof latestPlanRow?.race_date === 'string' ? latestPlanRow.race_date : '';
      if (latestRaceDate) {
        const parsedLatest = parseISO(latestRaceDate);
        if (isValidDate(parsedLatest)) return latestRaceDate;
      }

      return defaultRaceDateISO(raceType);
    })();

    const experienceResolved =
      typeof experience === 'string' && experience.trim()
        ? experience.trim()
        : typeof latestPlanParams?.experience === 'string' && latestPlanParams.experience.trim()
          ? latestPlanParams.experience.trim()
          : '';

    const maxHoursResolved = (() => {
      const raw = Number(maxHours);
      if (Number.isFinite(raw) && raw > 0) return raw;
      const latestRaw = Number(latestPlanParams?.maxHours);
      if (Number.isFinite(latestRaw) && latestRaw > 0) return latestRaw;
      return Number.NaN;
    })();

    if (!experienceResolved || !Number.isFinite(maxHoursResolved)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Please enter experience and weekly training hours to generate your plan.',
        },
        { status: 400 }
      );
    }

    const restDayResolved =
      restDay && restDay.trim() !== ''
        ? restDay
        : typeof latestPlanParams?.restDay === 'string' && latestPlanParams.restDay.trim() !== ''
          ? latestPlanParams.restDay
          : 'Monday';

    const stravaHistorySummary = undefined;

    const bikeFtpResolved = Number.isFinite(ftpNormalized as number)
      ? (ftpNormalized as number)
      : Number.isFinite(Number(latestPlanParams?.bikeFtp))
        ? Number(latestPlanParams?.bikeFtp)
        : inferredBaselines.estimatedFtp ?? undefined;

    const runPaceResolved =
      typeof runPace === 'string' && runPace.trim()
        ? runPace
        : typeof latestPlanParams?.runPace === 'string' && latestPlanParams.runPace.trim()
          ? latestPlanParams.runPace
          : inferredBaselines.estimatedRunThresholdPacePerKm ?? undefined;

    const userParams: UserParams = {
      raceType,
      raceDate: raceDateResolved,
      experience: experienceResolved,
      maxHours: maxHoursResolved,
      restDay: restDayResolved,
      bikeFtp: bikeFtpResolved,
      runPace: runPaceResolved,
      swimPace: swimPace ?? undefined,
      paceUnit: paceUnitResolved,
      trainingPrefs,
      stravaHistorySummary: stravaHistorySummary || undefined,
      preferredLongRideDay: preferredLongRideDayResolved,
      preferredLongRunDay: preferredLongRunDayResolved,
      unavailableDays: unavailableDaysResolved,
      swimComfort: swimComfortResolved,
      twoADaysAllowed: twoADaysAllowedResolved,
      athleteNotes: athleteNotesResolved || undefined,
      coachingPriorities: coachingPrioritiesResolved,
      constraintsSummary: constraintsSummary || undefined,
    };

    const todayISO = safeDateISO(new Date());
    const totalWeeks = computeTotalWeeks(todayISO, raceDateResolved);

    if (totalWeeks < 6) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Need at least 6 weeks until race day for a safe structured plan. Use race-readiness mode for shorter timelines.',
        },
        { status: 400 }
      );
    }

    const planMeta = buildPlanMeta(totalWeeks, todayISO);

    console.log("[finalize-plan] generation started", {
      userId,
      totalWeeks,
      planTypeResolved,
      raceType,
      raceDate: raceDateResolved,
      preferredLongRideDay: preferredLongRideDayResolved ?? null,
      preferredLongRunDay: preferredLongRunDayResolved ?? null,
      unavailableDays: unavailableDaysResolved,
      swimComfort: swimComfortResolved ?? null,
    });

    const genStart = Date.now();
    const weeks: WeekJson[] = new Array(planMeta.length);
    const generationConcurrency = Math.max(
      1,
      Math.min(4, Number(process.env.PLAN_GENERATION_CONCURRENCY ?? 3) || 3)
    );

    async function generateOneWeek(i: number, prevWeek?: WeekJson): Promise<WeekJson> {
      const elapsed = Date.now() - startedAt;
      if (elapsed > HARD_BUDGET_MS) {
        throw new Error(`Plan generation exceeded time budget (${Math.round(elapsed / 1000)}s).`);
      }

      const w0 = Date.now();
      const { generateWeek } = await import("@/utils/generate-week");
      const { guardWeek } = await import("@/utils/planGuard");

      console.log("[finalize-plan] week generation started", {
        weekIndex: i,
        weekLabel: planMeta[i]?.label,
        phase: planMeta[i]?.phase,
        concurrency: planTypeResolved === "triathlon" ? generationConcurrency : 1,
        elapsedSec: Math.round((Date.now() - startedAt) / 1000),
      });

      const raw: WeekJson = await generateWeek({
        weekMeta: planMeta[i],
        userParams,
        planType: planTypeResolved,
        index: i,
        prevWeek,
      });

      const normalizedRaw = normalizeGeneratedWeek(raw, planMeta[i]);

      let safeWeek: WeekJson;
      try {
        safeWeek = normalizeGeneratedWeek(
          guardWeek(normalizedRaw, userParams.trainingPrefs),
          planMeta[i]
        );
      } catch (guardErr) {
        console.error("[finalize-plan] guardWeek failed; using normalized generated week", {
          weekIndex: i,
          weekLabel: planMeta[i]?.label,
          error: guardErr instanceof Error ? guardErr.message : String(guardErr),
        });

        safeWeek = normalizedRaw;
      }

      const w1 = Date.now();
      console.log("[finalize-plan] week generated", {
        weekIndex: i,
        weekLabel: planMeta[i]?.label,
        phase: planMeta[i]?.phase,
        ms: w1 - w0,
        elapsedSec: Math.round((w1 - startedAt) / 1000),
      });

      return safeWeek;
    }

    if (planTypeResolved === "running" || planTypeResolved === "run") {
      // Running generation uses previous-week context heavily, so keep it sequential.
      for (let i = 0; i < planMeta.length; i++) {
        weeks[i] = await generateOneWeek(i, weeks[i - 1]);
      }
    } else {
      // Triathlon weeks are scaffolded independently enough to generate safely in small batches.
      // Avoid full Promise.all fan-out so we stay kind to rate limits and keep logs readable.
      for (let offset = 0; offset < planMeta.length; offset += generationConcurrency) {
        const batchIndexes = planMeta
          .slice(offset, offset + generationConcurrency)
          .map((_, batchOffset) => offset + batchOffset);

        const batchStartedAt = Date.now();
        console.log("[finalize-plan] week batch started", {
          indexes: batchIndexes,
          concurrency: generationConcurrency,
          elapsedSec: Math.round((Date.now() - startedAt) / 1000),
        });

        const batchResults = await Promise.all(
          batchIndexes.map((weekIndex) => generateOneWeek(weekIndex))
        );

        batchResults.forEach((week, idx) => {
          weeks[batchIndexes[idx]] = week;
        });

        console.log("[finalize-plan] week batch completed", {
          indexes: batchIndexes,
          ms: Date.now() - batchStartedAt,
          elapsedSec: Math.round((Date.now() - startedAt) / 1000),
        });
      }
    }

    console.log("[finalize-plan] all weeks generated", {
      ms: Date.now() - genStart,
      elapsedSec: Math.round((Date.now() - startedAt) / 1000),
      concurrency: planTypeResolved === "triathlon" ? generationConcurrency : 1,
    });

    if (weeks.length > 0) weeks[weeks.length - 1].phase = "Taper";

    const raceDay = safeDateISO(parseISO(raceDateResolved));
    const lastWeek = weeks[weeks.length - 1];
    if (lastWeek) {
      if (!lastWeek.days || typeof lastWeek.days !== 'object' || Array.isArray(lastWeek.days)) {
        lastWeek.days = {};
      }
      lastWeek.days[raceDay] = [`🏁 ${raceType} Race Day`];
    }

    const generatedPlan: GeneratedPlan = {
      planType: planTypeResolved,
      weeks,
      params: userParams,
      createdAt: new Date().toISOString(),
    };

    const repair = repairGeneratedPlan({
      plan: generatedPlan,
      userParams,
    });

    if (repair.changes.length > 0) {
      console.log("[plan-repair] applied", {
        userId,
        changes: repair.changes.slice(0, 20),
        totalChanges: repair.changes.length,
      });
    }

    const validation = validateGeneratedPlan({
      plan: repair.plan,
      expectedWeeks: totalWeeks,
      userParams,
    });

    console.log("[plan-validation] completed", {
      userId,
      score: validation.score,
      ok: validation.ok,
      stats: validation.stats,
      warnings: validation.warnings.slice(0, 12),
      errors: validation.errors.slice(0, 12),
    });

    if (!validation.ok) {
      console.error("[plan-validation] critical validation failure", {
        userId,
        raceType,
        raceDate: raceDateResolved,
        errors: validation.errors,
        warnings: validation.warnings.slice(0, 20),
      });

      throw new Error(
        "We couldn’t finish your plan because the generated schedule was incomplete. Please try again."
      );
    }

    const { data: upserted, error: upsertErr } = await supabase
      .from("plans")
      .upsert(
        {
          user_id: userId,
          race_date: raceDateResolved,
          race_type: raceType,
          plan: repair.plan,
          created_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select("id")
      .single();

    if (upsertErr) throw upsertErr;
    const planId = upserted?.id as string;

    const { error: delErr } = await supabase
      .from("sessions")
      .delete()
      .eq("user_id", userId);

    if (delErr) {
      console.error("[finalize-plan] delete sessions error", { userId, planId, delErr });
      throw delErr;
    }

    let sessionRows = convertPlanToSessions(userId, planId, repair.plan);
    console.log("[finalize-plan] session rows prepared", {
      userId,
      planId,
      count: sessionRows.length,
    });

    const seen = new Set<string>();
    sessionRows = sessionRows.filter((s) => {
      const key = `${s.date}-${s.sport}-${s.title ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (sessionRows.length > 0) {
      const { error: insErr } = await supabase.from("sessions").insert(sessionRows);
      if (insErr) {
        console.error("[finalize-plan] insert sessions error", insErr);
        console.error("[finalize-plan] insert sessions rows sample", sessionRows.slice(0, 3));
        throw insErr;
      }

      const { count, error: countErr } = await supabase
        .from("sessions")
        .select("id", { head: true, count: "exact" })
        .eq("user_id", userId)
        .eq("plan_id", planId);

      if (countErr) {
        console.error("[finalize-plan] post-insert count error", countErr);
      } else {
        console.log("[finalize-plan] sessions persisted", { userId, planId, count });
      }
    }

    try {
      const url = new URL(req.url);
      const origin =
        process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
        `${req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "")}://${
          req.headers.get("x-forwarded-host") ?? url.host
        }`;

      await fetch(`${origin}/api/send-welcome-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, planId }),
      });
    } catch (emailErr) {
      console.error("[finalize-plan] welcome email error", emailErr);
    }

    console.log("[finalize-plan] completed", {
      userId,
      planId,
      elapsedSec: Math.round((Date.now() - startedAt) / 1000),
    });

    return NextResponse.json({
      ok: true,
      planId,
      plan: repair.plan,
    });
  } catch (err: any) {
    console.error("FINALIZE_PLAN_ERROR", err?.message, err?.stack, err);

    if (err instanceof AuthError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.status }
      );
    }

    const rawMessage = String(err?.message ?? "");
    const safeMessage =
      rawMessage.includes("Cannot convert undefined or null to object")
        ? "We couldn’t generate your plan because one generated week was incomplete. Please try again."
        : rawMessage || "Internal error";

    return NextResponse.json(
      { ok: false, error: safeMessage },
      { status: 500 }
    );
  }
}
