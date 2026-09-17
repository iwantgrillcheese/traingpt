import { NextResponse } from "next/server";
import {
  addWeeks,
  differenceInCalendarWeeks,
  formatISO,
  isLeapYear,
  isValid as isValidDate,
  parseISO,
  startOfWeek,
} from "date-fns";

import type {
  DayOfWeek,
  GeneratedPlan,
  PlanType,
  UserParams,
  WeekJson,
  WeekMeta,
} from "@/types/plan";
import {
  AuthError,
  assertSameUser,
  createRouteSupabaseClient,
  requireUser,
} from "@/lib/supabase/server";
import { convertPlanToSessions } from "@/utils/convertPlanToSessions";
import { enforceTriathlonTimeBudget } from "@/utils/enforceTriathlonTimeBudget";
import { repairGeneratedPlan } from "@/utils/repairGeneratedPlan";
import { validateGeneratedPlan } from "@/utils/validateGeneratedPlan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_PLAN_WEEKS = 60;
const MIN_WEEKLY_HOURS = 2;
const MAX_WEEKLY_HOURS = 30;

function safeDateISO(date: Date): string {
  const copy = new Date(date);
  if (copy.getMonth() === 1 && copy.getDate() === 29 && !isLeapYear(copy)) copy.setDate(28);
  return formatISO(copy, { representation: "date" });
}

function buildPlanMeta(totalWeeks: number, startDateISO: string): WeekMeta[] {
  const start = startOfWeek(parseISO(startDateISO), { weekStartsOn: 1 });
  const peakWeeks = Math.min(2, Math.max(0, totalWeeks >= 10 ? 2 : totalWeeks >= 8 ? 1 : 0));
  const taperWeeks = Math.min(2, Math.max(1, totalWeeks >= 10 ? 2 : 1));
  const remaining = Math.max(0, totalWeeks - peakWeeks - taperWeeks);
  const baseWeeks = Math.max(1, Math.round(remaining * 0.5));
  const buildWeeks = Math.max(0, remaining - baseWeeks);
  const phases: Array<"Base" | "Build" | "Peak" | "Taper"> = [
    ...Array(baseWeeks).fill("Base"),
    ...Array(buildWeeks).fill("Build"),
    ...Array(peakWeeks).fill("Peak"),
    ...Array(taperWeeks).fill("Taper"),
  ];

  return Array.from({ length: totalWeeks }, (_, index) => {
    const phase = phases[index] ?? "Base";
    return {
      label: `Week ${index + 1}`,
      phase,
      startDate: safeDateISO(addWeeks(start, index)),
      deload: (phase === "Base" || phase === "Build") && index > 0 && (index + 1) % 4 === 0,
    };
  });
}

function secondsToHMM(totalSec: number): string {
  const safe = Number.isFinite(totalSec) ? Math.max(0, Math.floor(totalSec)) : 0;
  return `${Math.floor(safe / 3600)}h ${String(Math.floor((safe % 3600) / 60)).padStart(2, "0")}m`;
}

function secondsToPacePerKm(totalSecPerKm: number): string {
  if (!Number.isFinite(totalSecPerKm) || totalSecPerKm <= 0) return "unknown";
  const total = Math.round(totalSecPerKm);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")} / km`;
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

function recentRows(rows: StravaHistoryRow[], days: number) {
  const cutoff = Date.now() - days * 86_400_000;
  return rows.filter((row) => {
    const ms = new Date(row.start_date ?? "").getTime();
    return Number.isFinite(ms) && ms >= cutoff;
  });
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function computeStravaBaselines(rows: StravaHistoryRow[]) {
  const recent = recentRows(rows, 120);
  const runCandidates = recent.filter((row) => {
    const sport = String(row.sport_type ?? "").toLowerCase();
    return sport === "run" && (row.moving_time ?? 0) >= 25 * 60 && (row.moving_time ?? 0) <= 90 * 60;
  });
  const bikeCandidates = recent.filter((row) => {
    const sport = String(row.sport_type ?? "").toLowerCase();
    return sport === "bike" && (row.moving_time ?? 0) >= 30 * 60;
  });

  const runHrValues = runCandidates
    .map((row) => row.average_heartrate)
    .filter((value): value is number => Number.isFinite(value ?? Number.NaN));
  const runSpeedValues = runCandidates
    .map((row) => row.average_speed)
    .filter((value): value is number => Number.isFinite(value ?? Number.NaN) && (value ?? 0) > 0)
    .sort((a, b) => b - a)
    .slice(0, 3);
  const bikePowerValues = bikeCandidates
    .map((row) => row.weighted_average_watts ?? row.average_watts ?? null)
    .filter((value): value is number => Number.isFinite(value ?? Number.NaN) && (value ?? 0) > 0)
    .sort((a, b) => b - a)
    .slice(0, 3);

  const highRunHr = runHrValues.length
    ? runHrValues.slice().sort((a, b) => b - a)[Math.floor(runHrValues.length * 0.15)] ?? runHrValues[0]
    : null;
  const representativeRunSpeed = median(runSpeedValues);
  const representativeBikePower = median(bikePowerValues);

  return {
    estimatedFtp: representativeBikePower ? Math.round(representativeBikePower * 0.95) : null,
    estimatedLthr: highRunHr ? Math.round(highRunHr) : null,
    estimatedThresholdPacePerKm: representativeRunSpeed
      ? secondsToPacePerKm((1000 / representativeRunSpeed) * 1.02)
      : null,
  };
}

function inferAbilityFromStrava(rows: StravaHistoryRow[]): "beginner" | "intermediate" | "advanced" | null {
  const recent = recentRows(rows, 56);
  if (!recent.length) return null;
  const hoursPerWeek = recent.reduce((sum, row) => sum + Number(row.moving_time ?? 0), 0) / 3600 / 8;
  if (hoursPerWeek >= 9) return "advanced";
  if (hoursPerWeek >= 4.5) return "intermediate";
  return "beginner";
}

function buildStravaHistorySummary(rows: StravaHistoryRow[]) {
  const bySport = rows.reduce<Record<string, { count: number; seconds: number }>>((acc, row) => {
    const key = String(row.sport_type ?? "Other");
    acc[key] = acc[key] ?? { count: 0, seconds: 0 };
    acc[key].count += 1;
    acc[key].seconds += Number(row.moving_time ?? 0);
    return acc;
  }, {});
  const totalSeconds = rows.reduce((sum, row) => sum + Number(row.moving_time ?? 0), 0);
  const sports = Object.entries(bySport)
    .sort((a, b) => b[1].seconds - a[1].seconds)
    .map(([sport, stats]) => `${sport}: ${stats.count} activities, ${secondsToHMM(stats.seconds)}`)
    .join("; ");
  return rows.length
    ? `${rows.length} Strava activities in the last year, ${secondsToHMM(totalSeconds)} total. Sport balance: ${sports}.`
    : "No recent Strava history available.";
}

function normalizeDayName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const map: Record<string, string> = {
    mon: "Monday", monday: "Monday", tue: "Tuesday", tuesday: "Tuesday",
    wed: "Wednesday", wednesday: "Wednesday", thu: "Thursday", thursday: "Thursday",
    fri: "Friday", friday: "Friday", sat: "Saturday", saturday: "Saturday",
    sun: "Sunday", sunday: "Sunday",
  };
  return map[value.trim().toLowerCase()];
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
    : [];
}

function buildConstraintsSummary(args: {
  preferredLongRideDay?: string;
  preferredLongRunDay?: string;
  unavailableDays: string[];
  swimComfort?: string;
  twoADaysAllowed?: boolean;
  athleteNotes: string;
  coachingPriorities: string[];
}) {
  const parts = [
    args.preferredLongRideDay ? `Preferred long ride day: ${args.preferredLongRideDay}` : null,
    args.preferredLongRunDay ? `Preferred long run day: ${args.preferredLongRunDay}` : null,
    args.unavailableDays.length ? `Unavailable days: ${args.unavailableDays.join(", ")}` : null,
    args.swimComfort ? `Swim comfort: ${args.swimComfort}` : null,
    typeof args.twoADaysAllowed === "boolean" ? `Two-a-days allowed: ${args.twoADaysAllowed ? "yes" : "no"}` : null,
    args.coachingPriorities.length ? `Coaching priorities: ${args.coachingPriorities.join(", ")}` : null,
    args.athleteNotes ? `Athlete notes: ${args.athleteNotes}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(". ") : "No additional constraints provided.";
}

function normalizePlanType(value: unknown): PlanType {
  return value === "running" ? "running" : "triathlon";
}

type PaceUnit = "mi" | "km";

function parsePaceSeconds(value: unknown): number | null {
  const match = String(value ?? "").match(/(\d{1,2})\s*:\s*(\d{2})/);
  if (!match) return null;
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || seconds >= 60) return null;
  return minutes * 60 + seconds;
}

function explicitPaceUnit(value: unknown): PaceUnit | null {
  const text = String(value ?? "").toLowerCase();
  if (text.includes("/km") || text.includes("per km")) return "km";
  if (text.includes("/mi") || text.includes("/mile") || text.includes("per mile") || text.includes("per mi")) return "mi";
  return null;
}

function normalizePaceUnit(value: unknown): PaceUnit | undefined {
  return value === "km" || value === "mi" ? value : undefined;
}

function normalizeRunMetric(rawRunPace: unknown, rawPaceUnit: unknown, inferredRunPace?: string) {
  const selectedRaw = typeof rawRunPace === "string" && rawRunPace.trim() ? rawRunPace.trim() : inferredRunPace;
  if (!selectedRaw) return { runPace: undefined as string | undefined, paceUnit: normalizePaceUnit(rawPaceUnit) ?? ("mi" as PaceUnit) };
  const seconds = parsePaceSeconds(selectedRaw);
  const textUnit = explicitPaceUnit(selectedRaw);
  const requestedUnit = normalizePaceUnit(rawPaceUnit);
  const unit: PaceUnit = textUnit ?? requestedUnit ?? (seconds !== null && seconds < 330 ? "km" : "mi");
  const cleaned = selectedRaw.replace(/\s*(?:\/\s*(?:km|mi|mile)|per\s+(?:km|mi|mile))\s*$/i, "").trim();
  return { runPace: cleaned ? `${cleaned} / ${unit}` : selectedRaw, paceUnit: unit };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizeWeekDays(value: unknown): Record<string, any[]> {
  if (!isPlainRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).map(([key, items]) => [String(key), Array.isArray(items) ? items.filter((item) => typeof item === "string" || isPlainRecord(item)) : []])
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

function flattenWeekDays(weeks: WeekJson[]): Record<string, any[]> {
  return weeks.reduce<Record<string, any[]>>((acc, week) => {
    Object.entries(week.days).forEach(([date, sessions]) => { acc[date] = sessions; });
    return acc;
  }, {});
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  const HARD_BUDGET_MS = 285_000;

  try {
    const body = await req.json();
    const {
      raceType, raceDate, experience, maxHours, restDay, bikeFtp, bikeFTP, runPace, swimPace,
      planType, preferencesText, preferredLongRideDay, preferredLongRunDay, unavailableDays,
      swimComfort, twoADaysAllowed, athleteNotes, coachingPriorities, paceUnit, clientUserId,
    } = body ?? {};

    const supabase = await createRouteSupabaseClient(req);
    const user = await requireUser(supabase);
    const userId = user.id;

    if (typeof clientUserId !== "string" || !clientUserId) {
      return NextResponse.json({ ok: false, error: "Auth handshake missing. Refresh the app and try again." }, { status: 401 });
    }
    assertSameUser({ authenticatedUserId: userId, requestedUserId: clientUserId, routeName: "finalize-plan" });

    if (typeof raceType !== "string" || !raceType.trim()) {
      return NextResponse.json({ ok: false, error: "Choose a race type." }, { status: 400 });
    }

    const raceDateParsed = parseISO(String(raceDate ?? ""));
    if (!isValidDate(raceDateParsed)) {
      return NextResponse.json({ ok: false, error: "Choose a valid race date." }, { status: 400 });
    }
    const todayISO = formatISO(new Date(), { representation: "date" });
    if (String(raceDate) < todayISO) {
      return NextResponse.json({ ok: false, error: "Race date must be today or later." }, { status: 400 });
    }

    const weeklyHours = Number(maxHours);
    if (!Number.isFinite(weeklyHours) || weeklyHours < MIN_WEEKLY_HOURS || weeklyHours > MAX_WEEKLY_HOURS) {
      return NextResponse.json({ ok: false, error: `Weekly training time must be between ${MIN_WEEKLY_HOURS} and ${MAX_WEEKLY_HOURS} hours.` }, { status: 400 });
    }

    const explicitFtp = bikeFTP ?? bikeFtp;
    if (explicitFtp != null && String(explicitFtp).trim() !== "") {
      const ftp = Number(explicitFtp);
      if (!Number.isFinite(ftp) || ftp < 50 || ftp > 600) {
        return NextResponse.json({ ok: false, error: "Bike FTP looks invalid. Enter a value between 50 and 600 watts, or leave it blank." }, { status: 400 });
      }
    }

    const startDate = startOfWeek(new Date(), { weekStartsOn: 1 });
    const totalWeeks = Math.max(1, differenceInCalendarWeeks(raceDateParsed, startDate, { weekStartsOn: 1 }) + 1);
    if (totalWeeks > MAX_PLAN_WEEKS) {
      return NextResponse.json({ ok: false, error: `That race is more than ${MAX_PLAN_WEEKS} weeks away. Build the race-specific plan when you are closer.` }, { status: 400 });
    }
    const startDateISO = formatISO(startDate, { representation: "date" });
    const weekMeta = buildPlanMeta(totalWeeks, startDateISO);

    const stravaSinceISO = new Date(Date.now() - 365 * 86_400_000).toISOString();
    const { data: stravaRowsRaw, error: stravaRowsError } = await supabase
      .from("strava_activities")
      .select("sport_type,moving_time,distance,start_date,average_heartrate,max_heartrate,weighted_average_watts,average_watts,average_speed")
      .eq("user_id", userId)
      .gte("start_date", stravaSinceISO)
      .order("start_date", { ascending: false })
      .limit(1000);
    if (stravaRowsError) console.error("[finalize-plan] Strava history lookup failed; continuing without calibration", stravaRowsError);

    const stravaHistoryRows = (Array.isArray(stravaRowsRaw) ? stravaRowsRaw : []) as StravaHistoryRow[];
    const inferredBaselines = computeStravaBaselines(stravaHistoryRows);
    const inferredAbility = inferAbilityFromStrava(stravaHistoryRows);
    const stravaHistorySummary = buildStravaHistorySummary(stravaHistoryRows);

    const preferredLongRideDayResolved = normalizeDayName(preferredLongRideDay);
    const preferredLongRunDayResolved = normalizeDayName(preferredLongRunDay);
    const unavailableDaysResolved = normalizeStringArray(unavailableDays).map(normalizeDayName).filter((day): day is string => !!day);
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

    const normalizedPlanType = normalizePlanType(planType);
    const finalBikeFtp = explicitFtp != null && String(explicitFtp).trim() !== ""
      ? Number(explicitFtp)
      : inferredBaselines.estimatedFtp ?? undefined;
    const { runPace: finalRunPace, paceUnit: finalPaceUnit } = normalizeRunMetric(runPace, paceUnit, inferredBaselines.estimatedThresholdPacePerKm ?? undefined);
    const finalExperience = typeof experience === "string" && experience.trim() ? experience.trim() : inferredAbility ?? "Intermediate";

    const userParams: UserParams = {
      raceType: raceType.trim(),
      raceDate: String(raceDate),
      experience: finalExperience,
      maxHours: weeklyHours,
      restDay: typeof restDay === "string" ? restDay : undefined,
      bikeFTP: finalBikeFtp,
      bikeFtp: finalBikeFtp,
      runPace: finalRunPace,
      swimPace: typeof swimPace === "string" && swimPace.trim() ? swimPace.trim() : undefined,
      planType: normalizedPlanType,
      preferencesText: typeof preferencesText === "string" && preferencesText.trim() ? preferencesText.trim() : constraintsSummary,
      constraintsSummary,
      preferredLongRideDay: preferredLongRideDayResolved as DayOfWeek | undefined,
      preferredLongRunDay: preferredLongRunDayResolved as DayOfWeek | undefined,
      unavailableDays: unavailableDaysResolved as DayOfWeek[],
      swimComfort: swimComfortResolved,
      twoADaysAllowed: twoADaysAllowedResolved,
      athleteNotes: athleteNotesResolved,
      coachingPriorities: coachingPrioritiesResolved,
      paceUnit: finalPaceUnit,
      stravaHistorySummary,
    };

    let generatedWeeksRaw: WeekJson[];
    let scaffoldFirst = false;

    if (normalizedPlanType === "triathlon") {
      const { buildTriathlonWeekScaffold } = await import("@/utils/buildTriathlonScaffold");
      const scaffoldWeeks = weekMeta.map((meta, index) => buildTriathlonWeekScaffold({ userParams, weekMeta: meta, index, totalWeeks }));
      if (scaffoldWeeks.every((week): week is WeekJson => !!week)) {
        generatedWeeksRaw = scaffoldWeeks;
        scaffoldFirst = true;
      } else {
        const { startPlan } = await import("@/utils/start-plan");
        generatedWeeksRaw = await startPlan({ totalWeeks, weekMeta, userParams, deadlineMs: startedAt + HARD_BUDGET_MS });
      }
    } else {
      const { startPlan } = await import("@/utils/start-plan");
      generatedWeeksRaw = await startPlan({ totalWeeks, weekMeta, userParams, planType: normalizedPlanType, deadlineMs: startedAt + HARD_BUDGET_MS });
    }

    let generatedWeeks = generatedWeeksRaw.map((week, index) => normalizeGeneratedWeek(week, weekMeta[index]));
    let adjustedWeeks = 0;
    if (normalizedPlanType === "triathlon") {
      const budgeted = enforceTriathlonTimeBudget({ weeks: generatedWeeks, maxHours: weeklyHours, raceDate: String(raceDate) });
      generatedWeeks = budgeted.weeks;
      adjustedWeeks = budgeted.adjustedWeeks;
    }

    const generatedPlan: GeneratedPlan = {
      planType: normalizedPlanType,
      params: userParams,
      weeks: generatedWeeks,
      days: flattenWeekDays(generatedWeeks),
      metadata: {
        generatedAt: new Date().toISOString(),
        totalWeeks,
        source: scaffoldFirst ? "finalize-plan-scaffold" : "finalize-plan",
        stravaCalibrated: stravaHistoryRows.length > 0,
        timeBudgetAdjustedWeeks: adjustedWeeks,
        ...(scaffoldFirst ? { enrichment: { pending: true, enrichedWeeks: [] as number[] } } : {}),
      },
    };

    let planForStorage = generatedPlan;
    let validation = validateGeneratedPlan({ plan: generatedPlan, expectedWeeks: totalWeeks, userParams });

    if (!validation.ok) {
      console.warn("[finalize-plan] generated plan failed validation; repairing", { errors: validation.errors, warnings: validation.warnings });
      const repaired = repairGeneratedPlan({ plan: generatedPlan, userParams });
      planForStorage = { ...repaired.plan, days: flattenWeekDays(repaired.plan.weeks) };
      validation = validateGeneratedPlan({ plan: planForStorage, expectedWeeks: totalWeeks, userParams });
      if (!validation.ok) {
        console.error("[finalize-plan] repaired plan still failed quality gate", { errors: validation.errors, warnings: validation.warnings });
        return NextResponse.json({ ok: false, code: "PLAN_QUALITY_GATE_FAILED", error: "We could not build a plan that met Brick's quality checks. Your existing plan was not changed. Please try again.", issues: validation.errors.slice(0, 5) }, { status: 422 });
      }
    }

    const sessions = convertPlanToSessions(userId, userId, planForStorage as any);
    if (!sessions.length) {
      return NextResponse.json({ ok: false, code: "NO_SESSIONS", error: "The generated plan did not produce a usable schedule. Your existing plan was not changed." }, { status: 422 });
    }

    const { data: persisted, error: persistError } = await supabase.rpc("replace_plan_and_sessions", {
      p_user_id: userId,
      p_race_date: String(raceDate),
      p_race_type: raceType.trim(),
      p_plan: planForStorage,
      p_sessions: sessions,
    });

    if (persistError) {
      console.error("[finalize-plan] atomic plan persistence failed", persistError);
      return NextResponse.json({ ok: false, error: "Plan generation finished, but we could not safely save it. Your previous plan is still intact." }, { status: 500 });
    }

    const persistedRow = Array.isArray(persisted) ? persisted[0] : persisted;
    const planId = persistedRow?.plan_id;
    const sessionsCreated = Number(persistedRow?.sessions_created ?? sessions.length);
    if (!planId) {
      console.error("[finalize-plan] atomic persistence returned no plan id", persisted);
      return NextResponse.json({ ok: false, error: "Plan could not be confirmed after saving. Please try again." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      plan: planForStorage,
      planId,
      sessionsCreated,
      stravaCalibrated: stravaHistoryRows.length > 0,
      enrichmentPending: scaffoldFirst,
      totalWeeks,
      validationScore: validation.score,
      validationWarnings: validation.warnings.length,
      timeBudgetAdjustedWeeks: adjustedWeeks,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      console.error("FINALIZE_PLAN_ERROR Unauthorized", error);
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: error.status });
    }
    console.error("FINALIZE_PLAN_ERROR", error);
    return NextResponse.json({ ok: false, error: "Failed to generate plan" }, { status: 500 });
  }
}
