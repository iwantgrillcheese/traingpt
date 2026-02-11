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
import { startPlan } from "@/utils/start-plan";
import { convertPlanToSessions } from "@/utils/convertPlanToSessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/* ---------- helpers ---------- */

function safeDateISO(date: Date): string {
  const m = date.getMonth();
  const d = date.getDate();
  // Guard against Feb 29 on non-leap years (extra safety)
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

function buildStravaHistorySummary(
  rows: Array<{ sport_type: string | null; moving_time: number | null; distance: number | null; start_date: string | null }>
): string {
  if (!rows.length) return '';

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

  const sportLines = Array.from(bySport.entries())
    .sort((a, b) => b[1].sec - a[1].sec)
    .slice(0, 4)
    .map(([sport, data]) => `${sport}: ${data.sessions} sessions, ${secondsToHMM(data.sec)}`)
    .join(' | ');

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
    `Last 90 days: ${rows.length} activities, ${secondsToHMM(totalSec)} total, ${totalDistanceKm.toFixed(1)}km total distance.`,
    sportLines ? `Sport split: ${sportLines}.` : '',
    recent ? `Recent sessions: ${recent}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
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

    // ✅ Validation (restDay now optional)
    if (!raceType || !raceDate || !experience || !maxHours) {
      return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
    }

    const raceISO = parseISO(raceDate);
    if (!isValidDate(raceISO)) {
      return NextResponse.json({ ok: false, error: "Invalid raceDate" }, { status: 400 });
    }

    // ✅ Default rest day fallback
    const restDayResolved = restDay && restDay.trim() !== "" ? restDay : "Monday";

    const trainingPrefs = extractPrefs(preferencesText);

    // ✅ Normalize FTP to a number if present (avoid strings like "250")
    const ftpRaw = bikeFtp ?? bikeFTP;
    const ftpNormalized =
      ftpRaw === null || ftpRaw === undefined || String(ftpRaw).trim() === ""
        ? undefined
        : Number(ftpRaw);

    const paceUnitResolved: 'mi' | 'km' | undefined =
      paceUnit === 'km' || paceUnit === 'mi' ? paceUnit : undefined;

    let stravaHistorySummary = '';
    if ((planType ?? 'triathlon') === 'triathlon') {
      const sinceISO = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data: stravaRows, error: stravaErr } = await supabase
        .from('strava_activities')
        .select('sport_type,moving_time,distance,start_date')
        .eq('user_id', userId)
        .gte('start_date', sinceISO)
        .order('start_date', { ascending: false })
        .limit(150);

      if (stravaErr) {
        console.warn('[finalize-plan] strava history lookup failed', stravaErr);
      } else {
        stravaHistorySummary = buildStravaHistorySummary(stravaRows ?? []);
      }
    }

    const userParams: UserParams = {
      raceType,
      raceDate,
      experience,
      maxHours: Number(maxHours),
      restDay: restDayResolved,
      bikeFtp: Number.isFinite(ftpNormalized as number) ? (ftpNormalized as number) : undefined,
      runPace: runPace ?? undefined,
      swimPace: swimPace ?? undefined,
      paceUnit: paceUnitResolved,
      trainingPrefs,
      stravaHistorySummary: stravaHistorySummary || undefined,
    };

    // Compute meta now (light)
    const todayISO = safeDateISO(new Date());
    const totalWeeks = computeTotalWeeks(todayISO, raceDate);
    const planMeta = buildPlanMeta(totalWeeks, todayISO);
    const planTypeResolved: PlanType = planType ?? "triathlon";

    console.log("[finalize-plan] generation started", {
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
        throw new Error(`Plan generation exceeded time budget (${Math.round(elapsed / 1000)}s).`);
      }

      const w0 = Date.now();

      const singleWeek = await (async () => {
        const { generateWeek } = await import("@/utils/generate-week");
        const { guardWeek } = await import("@/utils/planGuard");

        // ✅ NEW: pass prevWeek for running continuity (triathlon path ignores it)
const prevWeek = weeks[i - 1];

const raw: WeekJson = await generateWeek({
  weekMeta: planMeta[i],
  userParams,
  planType: planTypeResolved,
  index: i,
  prevWeek,
});


        return guardWeek(raw, userParams.trainingPrefs);
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

    // Force taper + race day
    if (weeks.length > 0) weeks[weeks.length - 1].phase = "Taper";

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
      .from("plans")
      .upsert(
        {
          user_id: userId,
          race_date: raceDate,
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

    // Clear existing sessions for this plan
    const { error: delErr } = await supabase
      .from("sessions")
      .delete()
      .eq("user_id", userId)
      .eq("plan_id", planId);

    if (delErr) console.error("[finalize-plan] delete sessions error", delErr);

    // Convert → session rows (date-safe)
    let sessionRows = convertPlanToSessions(userId, planId, generatedPlan);

    // ✅ Deduplicate without dropping legit doubles
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

    // Welcome email (do not fail request if this fails)
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
    console.error("[finalize-plan] error", err);
    return NextResponse.json(
      { ok: false, error: "Internal error", details: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
