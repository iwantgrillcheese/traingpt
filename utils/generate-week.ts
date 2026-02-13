// utils/generate-week.ts
import OpenAI from "openai";
import { COACH_SYSTEM_PROMPT } from "@/lib/coachPrompt";
import { RUNNING_SYSTEM_PROMPT } from "@/lib/runningPrompt";
import { buildCoachPrompt } from "./buildCoachPrompt";
import { buildRunningPrompt } from "./buildRunningPrompt";
import { computeRunTargets } from "@/utils/runTargets";
import { validateRunWeek } from "@/utils/validateRunWeek";
import { stripUnsupportedParams } from "@/utils/openaiSafeParams";
import type { WeekMeta, UserParams, WeekJson, PlanType, DayOfWeek } from "@/types/plan";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

function toDayIndex(day?: string | null): number {
  const s = String(day ?? "").toLowerCase();
  const map: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };
  return map[s] ?? 1;
}

function isoDatesFromMonday(startDate: string): string[] {
  const start = new Date(`${startDate}T00:00:00`);
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function buildDeterministicRunFallback(args: {
  weekMeta: WeekMeta;
  userParams: UserParams;
  targets: {
    targetWeeklyMin: number;
    targetLongRunMin: number;
    minLongRunMin?: number;
    longRunMax: number;
    qualityDays: number;
    maxQualityMin: number;
    preferredLongRunDay: DayOfWeek;
  };
}): WeekJson {
  const { weekMeta, userParams, targets } = args;
  const dates = isoDatesFromMonday(weekMeta.startDate);
  const days: Record<string, string[]> = Object.fromEntries(dates.map((d) => [d, []]));

  const restDayIdx = toDayIndex(userParams.restDay);
  const longRunDow = Number(targets.preferredLongRunDay ?? 0);

  const dayMeta = dates.map((iso) => {
    const dow = new Date(`${iso}T00:00:00`).getDay();
    return { iso, dow };
  });

  const longTarget = Math.max(
    45,
    Math.min(
      targets.longRunMax,
      Math.max(targets.targetLongRunMin, targets.minLongRunMin ?? 0)
    )
  );

  const shouldAddQuality = targets.qualityDays > 0 && targets.maxQualityMin > 0;
  const qualityMin = shouldAddQuality ? Math.min(20, targets.maxQualityMin) : 0;

  const totalTarget = Math.max(longTarget + qualityMin + 60, targets.targetWeeklyMin);
  let remaining = totalTarget - longTarget - qualityMin;

  const easyRunSlots = dayMeta
    .filter((d) => d.dow !== longRunDow && d.dow !== restDayIdx)
    .map((d) => d.iso)
    .slice(0, 3);

  const easyMins = easyRunSlots.map((_, idx) => {
    const slotsLeft = easyRunSlots.length - idx;
    const v = Math.max(30, Math.round(remaining / slotsLeft));
    remaining -= v;
    return v;
  });

  // Rest day
  const rest = dayMeta.find((d) => d.dow === restDayIdx)?.iso;
  if (rest) days[rest] = ["Rest"];

  // Long run on preferred day
  const longDay = dayMeta.find((d) => d.dow === longRunDow)?.iso ?? dates[dates.length - 1];
  days[longDay] = [`🏃 Long Run — ${longTarget}min steady aerobic — Details`];

  // Optional single quality day (never adjacent to long run)
  if (shouldAddQuality) {
    const longIdx = dayMeta.findIndex((d) => d.iso === longDay);
    const qualityCandidate = dayMeta.find((d, idx) => {
      if (d.iso === longDay || d.iso === rest) return false;
      if (Math.abs(idx - longIdx) <= 1) return false;
      return true;
    })?.iso;

    if (qualityCandidate) {
      days[qualityCandidate] = [
        `🏃 Run — ${qualityMin}min quality (short strides within easy run) — Details`,
      ];
    }
  }

  // Easy runs fill remaining volume
  easyRunSlots.forEach((iso, i) => {
    if (days[iso]?.length) return;
    const m = easyMins[i] ?? 35;
    days[iso] = [`🏃 Run — ${m}min easy aerobic — Details`];
  });

  return {
    label: weekMeta.label,
    phase: weekMeta.phase,
    startDate: weekMeta.startDate,
    deload: weekMeta.deload,
    days,
  } as WeekJson;
}

export async function generateWeek({
  weekMeta,
  userParams,
  planType = "triathlon",
  index,
  prevWeek,
}: {
  weekMeta: WeekMeta;
  userParams: UserParams;
  planType?: PlanType;
  index?: number;
  prevWeek?: WeekJson;
}): Promise<WeekJson> {
  const isRunPlan = planType === "running" || planType === "run";
  const runModel = process.env.RUNNING_PLAN_MODEL ?? process.env.PLAN_MODEL ?? "gpt-5-mini";
  const defaultModel = process.env.PLAN_MODEL ?? "gpt-4o";
  const model = isRunPlan ? runModel : defaultModel;

  // Always normalize week index (prevents undefined + removes 0/1-based ambiguity in prompt layer)
  const weekIndex = index ?? 0;

  // Running-only targets + prompt
  const targets = isRunPlan
    ? computeRunTargets({ userParams, weekMeta, weekIndex, prevWeek })
    : null;

  const userMsg = isRunPlan
    ? buildRunningPrompt({
        userParams,
        weekMeta,
        index: weekIndex,
        targets: targets
          ? {
              targetWeeklyMin: targets.targetWeeklyMin,
              targetLongRunMin: targets.targetLongRunMin,
              minLongRunMin: targets.minLongRunMin,
              longRunMax: targets.longRunMax,
              qualityDays: targets.qualityDays,
              maxQualityMin: targets.maxQualityMin,
              maxSingleRunMin: targets.maxSingleRunMin,
              preferredLongRunDay: (userParams.trainingPrefs?.longRunDay ?? 0) as DayOfWeek,
              raceFamily: targets.raceFamily,
              weeksToRace: targets.weeksToRace,
            }
          : undefined,
        prevSummary: {
          prevWeeklyMin: targets?.prevWeeklyMin ?? undefined,
          prevLongRunMin: targets?.prevLongRunMin ?? undefined,
        },
      })
    : buildCoachPrompt({ userParams, weekMeta, index: weekIndex });

  const systemPrompt = isRunPlan ? RUNNING_SYSTEM_PROMPT : COACH_SYSTEM_PROMPT;

  async function callLLM(extraFixText?: string): Promise<WeekJson> {
    const resp = await openai.chat.completions.create(
      stripUnsupportedParams({
        model,
        top_p: 1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: extraFixText ? `${userMsg}\n\n## Fix Required\n${extraFixText}` : userMsg,
          },
        ],
      })
    );

    const content = resp.choices[0]?.message?.content ?? "{}";
    try {
      return JSON.parse(content) as WeekJson;
    } catch {
      const repairResp = await openai.chat.completions.create(
        stripUnsupportedParams({
          model,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `${userMsg}\n\nReturn ONLY valid JSON. No prose, no markdown, no code fences.`,
            },
          ],
        })
      );
      const repaired = repairResp.choices[0]?.message?.content ?? "{}";
      return JSON.parse(repaired) as WeekJson;
    }
  }

  // First attempt
  let currentWeek = await callLLM();

  // Running-only validation + rerolls
  if (isRunPlan && targets) {
    const preferredLongRunDay = (userParams.trainingPrefs?.longRunDay ?? 0) as DayOfWeek;

    let bestWeek = currentWeek;
    let bestValidation = validateRunWeek({
      week: bestWeek,
      userParams,
      weekMeta: { deload: weekMeta.deload },
      targets: {
        targetWeeklyMin: targets.targetWeeklyMin,
        targetLongRunMin: targets.targetLongRunMin,
        minLongRunMin: targets.minLongRunMin,
        longRunMax: targets.longRunMax,
        maxSingleRunMin: targets.maxSingleRunMin,
        qualityDays: targets.qualityDays,
        maxQualityMin: targets.maxQualityMin,
        raceFamily: targets.raceFamily,
        preferredLongRunDay,
      },
      prevWeek,
    });

    if (bestValidation.ok) return bestWeek;

    const isSafetyCriticalError = (msg: string) =>
      /missing duration|back-to-back hard|longest run is not scheduled|exceeds maxSingleRunMin|exceeds max|below minimum floor/i.test(msg);

    // Give the model a limited number of correction attempts and keep the best candidate by error count.
    for (let attempt = 0; attempt < 2; attempt++) {
      const v = validateRunWeek({
        week: currentWeek,
        userParams,
        weekMeta: { deload: weekMeta.deload },
        targets: {
          targetWeeklyMin: targets.targetWeeklyMin,
          targetLongRunMin: targets.targetLongRunMin,
          minLongRunMin: targets.minLongRunMin,
          longRunMax: targets.longRunMax,
          maxSingleRunMin: targets.maxSingleRunMin,
          qualityDays: targets.qualityDays,
          maxQualityMin: targets.maxQualityMin,
          raceFamily: targets.raceFamily,
          preferredLongRunDay,
        },
        prevWeek,
      });

      if (v.ok) return currentWeek;

      const safetyCritical = v.errors.filter(isSafetyCriticalError);
      if (safetyCritical.length === 0) {
        console.warn('[generateWeek] accepting non-critical validation drift', {
          weekLabel: weekMeta.label,
          errorCount: v.errors.length,
          topErrors: v.errors.slice(0, 3),
        });
        return currentWeek;
      }

      console.warn('[generateWeek] validation reroll', {
        weekLabel: weekMeta.label,
        attempt: attempt + 1,
        errorCount: v.errors.length,
        topErrors: v.errors.slice(0, 3),
      });

      if (v.errors.length < bestValidation.errors.length) {
        bestValidation = v;
        bestWeek = currentWeek;
      }

      const topIssues = v.errors.slice(0, 10);
      const previousWeekBlock = prevWeek
        ? `\nPrevious week snapshot (for continuity):\n${JSON.stringify(prevWeek, null, 2)}`
        : "";

      const fix = `Regenerate the week to satisfy ALL Weekly Targets and rules.
Problems detected:
- ${topIssues.join("\n- ")}

Hard constraints:
- Weekly minutes target: ${targets.targetWeeklyMin} (±5%)
- Long run target: ${targets.targetLongRunMin} (must be within tolerance)
- Long run minimum floor: ${targets.minLongRunMin ?? 0}
- Long run maximum: ${targets.longRunMax}
- Max single run duration: ${targets.maxSingleRunMin ?? 'n/a'}
- Hard days ≤ ${targets.qualityDays}
- Total hard-run minutes ≤ ${targets.maxQualityMin}
- Longest run must land on preferred long run day (${preferredLongRunDay})

Return complete JSON week object only, with all 7 day keys for the requested week.
Important: Every run must include duration and longest run must be on the preferred long run day.${previousWeekBlock}`;

      currentWeek = await callLLM(fix);
    }

    // If still failing after rerolls, never return a safety-invalid week.
    const finalValidation = validateRunWeek({
      week: bestWeek,
      userParams,
      weekMeta: { deload: weekMeta.deload },
      targets: {
        targetWeeklyMin: targets.targetWeeklyMin,
        targetLongRunMin: targets.targetLongRunMin,
        minLongRunMin: targets.minLongRunMin,
        longRunMax: targets.longRunMax,
        maxSingleRunMin: targets.maxSingleRunMin,
        qualityDays: targets.qualityDays,
        maxQualityMin: targets.maxQualityMin,
        raceFamily: targets.raceFamily,
        preferredLongRunDay,
      },
      prevWeek,
    });

    const finalSafetyErrors = finalValidation.errors.filter(isSafetyCriticalError);
    if (finalSafetyErrors.length > 0) {
      console.error('[generateWeek] using deterministic fallback due to unresolved safety errors', {
        weekLabel: weekMeta.label,
        topErrors: finalSafetyErrors.slice(0, 5),
      });

      return buildDeterministicRunFallback({
        weekMeta,
        userParams,
        targets: {
          targetWeeklyMin: targets.targetWeeklyMin,
          targetLongRunMin: targets.targetLongRunMin,
          minLongRunMin: targets.minLongRunMin,
          longRunMax: targets.longRunMax,
          qualityDays: targets.qualityDays,
          maxQualityMin: targets.maxQualityMin,
          preferredLongRunDay,
        },
      });
    }

    return bestWeek;
  }

  return currentWeek;
}
