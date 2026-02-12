import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
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
      paceUnit,
    } = body ?? {};

    const supabase = createRouteHandlerClient({ cookies });
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;

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

    const trainingPrefs = extractPrefs(preferencesText);

    const ftpRaw = bikeFtp ?? bikeFTP;
    const ftpNormalized =
      ftpRaw === null || ftpRaw === undefined || String(ftpRaw).trim() === ""
        ? undefined
        : Number(ftpRaw);

    const paceUnitResolved: "mi" | "km" | undefined =
      paceUnit === "km" || paceUnit === "mi" ? paceUnit : undefined;

    const planTypeResolved: PlanType = planType ?? "triathlon";

    let stravaRows: StravaHistoryRow[] = [];
    const sinceISO = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error: stravaErr } = await supabase
      .from('strava_activities')
      .select(
        'sport_type,moving_time,distance,start_date,average_heartrate,max_heartrate,weighted_average_watts,average_watts,average_speed'
      )
      .eq('user_id', userId)
      .gte('start_date', sinceISO)
      .order('start_date', { ascending: false })
      .limit(500);

    if (stravaErr) {
      console.warn('[finalize-plan] strava history lookup failed', stravaErr);
    } else {
      stravaRows = data ?? [];
    }

    const hasStravaHistory = stravaRows.length > 0;
    const inferredAbility = inferAbilityFromStrava(stravaRows);
    const inferredBaselines = computeStravaBaselines(stravaRows);

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
          : hasStravaHistory
            ? inferredAbility.experience
            : '';

    const maxHoursResolved = (() => {
      const raw = Number(maxHours);
      if (Number.isFinite(raw) && raw > 0) return raw;
      const latestRaw = Number(latestPlanParams?.maxHours);
      if (Number.isFinite(latestRaw) && latestRaw > 0) return latestRaw;
      return hasStravaHistory ? inferredAbility.maxHours : Number.NaN;
    })();

    if (!experienceResolved || !Number.isFinite(maxHoursResolved)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Please connect Strava (recommended for quick start) or enter experience + weekly time to generate your plan.',
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

    const stravaHistorySummary = buildStravaHistorySummary(stravaRows);

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
    };

    const todayISO = safeDateISO(new Date());
    const totalWeeks = computeTotalWeeks(todayISO, raceDateResolved);
    const planMeta = buildPlanMeta(totalWeeks, todayISO);

    console.log("[finalize-plan] generation started", {
      userId,
      totalWeeks,
      planTypeResolved,
      raceType,
      raceDate: raceDateResolved,
    });

    const genStart = Date.now();
    const weeks: WeekJson[] = [];

    for (let i = 0; i < planMeta.length; i++) {
      const elapsed = Date.now() - startedAt;
      if (elapsed > HARD_BUDGET_MS) {
        throw new Error(`Plan generation exceeded time budget (${Math.round(elapsed / 1000)}s).`);
      }

      const w0 = Date.now();

      const singleWeek = await (async () => {
        const { generateWeek } = await import("@/utils/generate-week");
        const { guardWeek } = await import("@/utils/planGuard");

        const prevWeek = weeks[i - 1];

        const raw: WeekJson = await generateWeek({
          weekMeta: planMeta[i],
          userParams,
          planType: planTypeResolved,
          index: i,
          prevWeek,
        });

        const guarded = guardWeek(raw, userParams.trainingPrefs);

        return {
          ...guarded,
          days:
            guarded?.days && typeof guarded.days === 'object' && !Array.isArray(guarded.days)
              ? guarded.days
              : {},
        } as WeekJson;
      })();

      weeks.push(singleWeek);

      const w1 = Date.now();
      console.log("[finalize-plan] week generated", {
        weekIndex: i,
        weekLabel: planMeta[i]?.label,
        phase: planMeta[i]?.phase,
        ms: w1 - w0,
        elapsedSec: Math.round((w1 - startedAt) / 1000),
      });
    }

    console.log("[finalize-plan] all weeks generated", {
      ms: Date.now() - genStart,
      elapsedSec: Math.round((Date.now() - startedAt) / 1000),
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

    const { data: upserted, error: upsertErr } = await supabase
      .from("plans")
      .upsert(
        {
          user_id: userId,
          race_date: raceDateResolved,
          race_type: raceType,
          plan: generatedPlan,
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
      .eq("user_id", userId)
      .eq("plan_id", planId);

    if (delErr) console.error("[finalize-plan] delete sessions error", delErr);

    let sessionRows = convertPlanToSessions(userId, planId, generatedPlan);

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
      plan: generatedPlan,
    });
  } catch (err: any) {
    console.error("FINALIZE_PLAN_ERROR", err?.message, err?.stack, err);
    return NextResponse.json(
      { error: err?.message ?? "Internal error" },
      { status: 500 }
    );
  }
}
