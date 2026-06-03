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

import type { UserParams, WeekMeta, PlanType, GeneratedPlan, WeekJson, DayOfWeek } from "@/types/plan";
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
    .map((r) => r.weighted_average_watts ?? r.average_watts ?? null)
    .filter((v): v is number => Number.isFinite(v ?? Number.NaN) && (v ?? 0) > 0);

  const estimatedLthr = runHrValues.length
    ? Math.round(runHrValues.slice().sort((a, b) => b - a)[Math.floor(runHrValues.length * 0.15)] ?? runHrValues[0])
    : null;

  const bestBikePower = bikePowerValues.length ? Math.max(...bikePowerValues) : null;
  const estimatedFtp = bestBikePower ? Math.round(bestBikePower * 0.95) : null;

  const bestRunSpeed = runSpeedValues.length ? Math.max(...runSpeedValues) : null;
  const estimatedThresholdPacePerKm = bestRunSpeed ? secondsToPacePerKm(1000 / bestRunSpeed) : null;

  return {
    estimatedFtp,
    estimatedLthr,
    estimatedThresholdPacePerKm,
  };
}

function inferAbilityFromStrava(rows: StravaHistoryRow[]): "beginner" | "intermediate" | "advanced" | null {
  if (!rows.length) return null;

  const recentSeconds = rows.reduce((sum, row) => sum + (row.moving_time ?? 0), 0);
  const recentHours = recentSeconds / 3600;

  if (recentHours >= 120) return "advanced";
  if (recentHours >= 35) return "intermediate";
  return "beginner";
}

function buildStravaHistorySummary(rows: StravaHistoryRow[]) {
  const bySport = rows.reduce<Record<string, { count: number; seconds: number }>>((acc, row) => {
    const key = String(row.sport_type ?? "Other");
    acc[key] = acc[key] ?? { count: 0, seconds: 0 };
    acc[key].count += 1;
    acc[key].seconds += row.moving_time ?? 0;
    return acc;
  }, {});

  const totalSeconds = rows.reduce((sum, row) => sum + (row.moving_time ?? 0), 0);
  const sportLines = Object.entries(bySport)
    .sort((a, b) => b[1].seconds - a[1].seconds)
    .map(([sport, stats]) => `${sport}: ${stats.count} activities, ${secondsToHMM(stats.seconds)}`)
    .join("; ");

  return rows.length
    ? `${rows.length} Strava activities in the last year, ${secondsToHMM(totalSeconds)} total. Sport balance: ${sportLines}.`
    : "No recent Strava history available.";
}

function normalizeDayName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.trim().toLowerCase();
  const map: Record<string, string> = {
    mon: "Monday",
    monday: "Monday",
    tue: "Tuesday",
    tuesday: "Tuesday",
    wed: "Wednesday",
    wednesday: "Wednesday",
    thu: "Thursday",
    thursday: "Thursday",
    fri: "Friday",
    friday: "Friday",
    sat: "Saturday",
    saturday: "Saturday",
    sun: "Sunday",
    sunday: "Sunday",
  };
  return map[cleaned];
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim())
    : [];
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
  athleteNotes: string;
  coachingPriorities: string[];
}) {
  const parts = [
    preferredLongRideDay ? `Preferred long ride day: ${preferredLongRideDay}` : null,
    preferredLongRunDay ? `Preferred long run day: ${preferredLongRunDay}` : null,
    unavailableDays.length ? `Unavailable days: ${unavailableDays.join(", ")}` : null,
    swimComfort ? `Swim comfort: ${swimComfort}` : null,
    typeof twoADaysAllowed === "boolean" ? `Two-a-days allowed: ${twoADaysAllowed ? "yes" : "no"}` : null,
    coachingPriorities.length ? `Coaching priorities: ${coachingPriorities.join(", ")}` : null,
    athleteNotes ? `Athlete notes: ${athleteNotes}` : null,
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
  const selectedRaw = typeof rawRunPace === "string" && rawRunPace.trim()
    ? rawRunPace.trim()
    : inferredRunPace;

  if (!selectedRaw) return { runPace: undefined as string | undefined, paceUnit: normalizePaceUnit(rawPaceUnit) ?? "mi" as PaceUnit };

  const seconds = parsePaceSeconds(selectedRaw);
  const textUnit = explicitPaceUnit(selectedRaw);
  const requestedUnit = normalizePaceUnit(rawPaceUnit);

  // If a pace is 5:29 or faster and has no explicit unit, treating it as /mi creates
  // absurd easy-run targets for almost every TrainGPT athlete. This usually means
  // Strava/mobile supplied a per-km threshold without carrying the unit through.
  const unit: PaceUnit = textUnit ?? requestedUnit ?? (seconds !== null && seconds < 330 ? "km" : "mi");
  const suffix = unit === "km" ? " / km" : " / mi";
  const cleaned = selectedRaw.replace(/\s*(?:\/\s*(?:km|mi|mile)|per\s+(?:km|mi|mile))\s*$/i, "").trim();

  return {
    runPace: cleaned ? `${cleaned}${suffix}` : selectedRaw,
    paceUnit: unit,
  };
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

function flattenWeekDays(weeks: WeekJson[]): Record<string, any[]> {
  return weeks.reduce<Record<string, any[]>>((acc, week) => {
    Object.entries(week.days).forEach(([date, sessions]) => {
      acc[date] = sessions;
    });
    return acc;
  }, {});
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

    const supabase = await createRouteSupabaseClient(req);
    const user = await requireUser(supabase);
    const userId = user.id;

    if (typeof clientUserId !== "string" || !clientUserId) {
      console.error("[finalize-plan] missing client user id", { cookieUserId: userId });
      return NextResponse.json(
        {
          ok: false,
          error: "Auth handshake missing. Refresh the app and try again.",
        },
        { status: 401 }
      );
    }

    assertSameUser({
      authenticatedUserId: userId,
      requestedUserId: clientUserId,
      routeName: "finalize-plan",
    });

    const stravaSinceISO = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const { data: stravaRowsRaw, error: stravaRowsError } = await supabase
      .from("strava_activities")
      .select("sport_type,moving_time,distance,start_date,average_heartrate,max_heartrate,weighted_average_watts,average_watts,average_speed")
      .eq("user_id", userId)
      .gte("start_date", stravaSinceISO)
      .order("start_date", { ascending: false })
      .limit(500);

    if (stravaRowsError) {
      console.error("[finalize-plan] Strava history lookup failed; continuing without Strava calibration", stravaRowsError);
    }

    const stravaHistoryRows = (Array.isArray(stravaRowsRaw) ? stravaRowsRaw : []) as StravaHistoryRow[];
    const inferredBaselines = computeStravaBaselines(stravaHistoryRows);
    const inferredAbility = inferAbilityFromStrava(stravaHistoryRows);
    const stravaHistorySummary = buildStravaHistorySummary(stravaHistoryRows);

    if (!raceType) {
      return NextResponse.json({ ok: false, error: "Missing race type" }, { status: 400 });
    }

    const raceDateParsed = parseISO(String(raceDate));
    if (!isValidDate(raceDateParsed)) {
      return NextResponse.json({ ok: false, error: "Invalid race date" }, { status: 400 });
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

    const startDate = startOfWeek(new Date(), { weekStartsOn: 1 });
    const totalWeeks = Math.max(
      1,
      differenceInCalendarWeeks(raceDateParsed, startDate, { weekStartsOn: 1 }) + 1
    );
    const startDateISO = formatISO(startDate, { representation: "date" });
    const weekMeta = buildPlanMeta(totalWeeks, startDateISO);

    const normalizedPlanType = normalizePlanType(planType);
    const finalBikeFtp = Number.isFinite(Number(bikeFTP ?? bikeFtp))
      ? Number(bikeFTP ?? bikeFtp)
      : inferredBaselines.estimatedFtp ?? undefined;
    const { runPace: finalRunPace, paceUnit: finalPaceUnit } = normalizeRunMetric(
      runPace,
      paceUnit,
      inferredBaselines.estimatedThresholdPacePerKm ?? undefined
    );
    const finalExperience = typeof experience === "string" && experience.trim()
      ? experience.trim()
      : inferredAbility ?? undefined;

    const userParams: UserParams = {
      raceType: String(raceType),
      raceDate: String(raceDate),
      experience: finalExperience,
      maxHours: Number(maxHours),
      restDay: typeof restDay === "string" ? restDay : undefined,
      bikeFTP: finalBikeFtp,
      runPace: finalRunPace,
      swimPace: typeof swimPace === "string" && swimPace.trim() ? swimPace.trim() : undefined,
      planType: normalizedPlanType,
      preferencesText: typeof preferencesText === "string" && preferencesText.trim()
        ? preferencesText.trim()
        : constraintsSummary,
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

    const { startPlan } = await import("@/utils/start-plan");

    const generatedWeeksRaw = await startPlan({
      totalWeeks,
      weekMeta,
      userParams,
      deadlineMs: startedAt + HARD_BUDGET_MS,
    });

    const generatedWeeks = generatedWeeksRaw.map((week, index) => normalizeGeneratedWeek(week, weekMeta[index]));

    const generatedPlan: GeneratedPlan = {
      planType: normalizedPlanType,
      params: userParams,
      weeks: generatedWeeks,
      days: flattenWeekDays(generatedWeeks),
      metadata: {
        generatedAt: new Date().toISOString(),
        totalWeeks,
        source: "finalize-plan",
        stravaCalibrated: stravaHistoryRows.length > 0,
      },
    };

    let planForStorage = generatedPlan;
    const validation = validateGeneratedPlan({
      plan: generatedPlan,
      expectedWeeks: totalWeeks,
      userParams,
    });

    if (!validation.ok) {
      console.warn("[finalize-plan] Generated plan failed validation; repairing", {
        errors: validation.errors,
        warnings: validation.warnings,
      });

      const repaired = repairGeneratedPlan({
        plan: generatedPlan,
        userParams,
      });

      planForStorage = {
        ...repaired.plan,
        days: flattenWeekDays(repaired.plan.weeks),
      };
    }

    const { data: upsertedPlan, error: planSaveError } = await supabase
      .from("plans")
      .upsert(
        {
          user_id: userId,
          race_date: String(raceDate),
          race_type: String(raceType),
          plan: planForStorage,
        },
        { onConflict: "user_id" }
      )
      .select("id")
      .single();

    if (planSaveError || !upsertedPlan?.id) {
      console.error("[finalize-plan] plan save failed", planSaveError);
      return NextResponse.json({ ok: false, error: "Plan generated but could not be saved" }, { status: 500 });
    }

    const sessions = convertPlanToSessions(userId, upsertedPlan.id, planForStorage as any);

    await supabase.from("sessions").delete().eq("user_id", userId);

    if (sessions.length) {
      const { error: sessionsError } = await supabase.from("sessions").insert(sessions);
      if (sessionsError) {
        console.error("[finalize-plan] session save failed", sessionsError);
        return NextResponse.json({ ok: false, error: "Plan generated but sessions could not be saved" }, { status: 500 });
      }
    }

    return NextResponse.json({
      ok: true,
      plan: planForStorage,
      planId: upsertedPlan.id,
      sessionsCreated: sessions.length,
      stravaCalibrated: stravaHistoryRows.length > 0,
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
