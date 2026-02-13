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

  const dayMeta = dates.map((iso, idx) => ({
    iso,
    idx,
    dow: new Date(`${iso}T00:00:00`).getDay(),
  }));

  const restIso = dayMeta.find((d) => d.dow === restDayIdx)?.iso ?? dayMeta[0].iso;
  const longIso = dayMeta.find((d) => d.dow === longRunDow)?.iso ?? dayMeta[6].iso;
  const longIdx = dayMeta.findIndex((d) => d.iso === longIso);

  const longTarget = Math.max(
    45,
    Math.min(targets.longRunMax, Math.max(targets.targetLongRunMin, targets.minLongRunMin ?? 0))
  );

  // one quality day max in fallback to keep safety high
  const qualityMin = targets.qualityDays > 0 && targets.maxQualityMin > 0
    ? Math.min(20, targets.maxQualityMin)
    : 0;

  const candidates = dayMeta.filter((d) => d.iso !== restIso && d.iso !== longIso);
  const qualityIso = qualityMin > 0
    ? candidates.find((d) => Math.abs(d.idx - longIdx) > 1)?.iso ?? null
    : null;

  const mediumIso = candidates
    .filter((d) => d.iso !== qualityIso)
    .sort((a, b) => Math.abs(a.idx - longIdx) - Math.abs(b.idx - longIdx))[0]?.iso ?? null;

  const easyIsos = candidates.filter((d) => d.iso !== qualityIso && d.iso !== mediumIso).map((d) => d.iso);

  const mediumMin = mediumIso ? Math.max(55, Math.min(80, Math.round(longTarget * 0.65))) : 0;

  let easyTotal = targets.targetWeeklyMin - longTarget - qualityMin - mediumMin;
  const easyCount = Math.max(1, easyIsos.length);
  const minEasy = 30;
  if (easyTotal < easyCount * minEasy) easyTotal = easyCount * minEasy;

  const preferredEasyPattern = [35, 45, 50, 40, 55];
  const easyMins = easyIsos.map((_, i) => preferredEasyPattern[i % preferredEasyPattern.length]);
  const currentEasy = easyMins.reduce((a, b) => a + b, 0);
  let delta = easyTotal - currentEasy;
  for (let i = 0; i < easyMins.length && delta !== 0; i++) {
    const step = delta > 0 ? 5 : -5;
    const next = Math.max(minEasy, Math.min(60, easyMins[i] + step));
    delta -= next - easyMins[i];
    easyMins[i] = next;
  }

  days[restIso] = ["Rest"];
  days[longIso] = [`🏃 Long Run — ${longTarget}min steady aerobic (last 15min moderate) — Details`];

  if (qualityIso && qualityMin > 0) {
    days[qualityIso] = [
      `🏃 Run — ${qualityMin}min quality (controlled intervals, not all-out) — Details`,
    ];
  }

  if (mediumIso && mediumMin > 0) {
    days[mediumIso] = [`🏃 Run — ${mediumMin}min medium-long easy aerobic — Details`];
  }

  easyIsos.forEach((iso, i) => {
    const m = easyMins[i] ?? 40;
    const withStrides = i === 0 ? ' + 6x20s strides' : '';
    days[iso] = [`🏃 Run — ${m}min easy aerobic${withStrides} — Details`];
  });

  // Ensure exactly 7 keys and no empty arrays.
  for (const iso of dates) {
    if (!Array.isArray(days[iso]) || days[iso].length === 0) {
      days[iso] = ["Rest"];
    }
  }

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

  if (isRunPlan && targets) {
    const deterministicFirst = process.env.RUNNING_DETERMINISTIC_FIRST !== "false";
    if (deterministicFirst) {
      const preferredLongRunDay = (userParams.trainingPrefs?.longRunDay ?? 0) as DayOfWeek;
      const deterministicWeek = buildDeterministicRunFallback({
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

      const deterministicValidation = validateRunWeek({
        week: deterministicWeek,
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

      if (deterministicValidation.ok) {
        console.log('[generateWeek] deterministic week accepted', {
          weekLabel: weekMeta.label,
          targetWeeklyMin: targets.targetWeeklyMin,
          targetLongRunMin: targets.targetLongRunMin,
        });
        return deterministicWeek;
      }

      console.warn('[generateWeek] deterministic week failed validation; falling back to LLM', {
        weekLabel: weekMeta.label,
        errors: deterministicValidation.errors.slice(0, 5),
      });
    }
  }

  async function callLLM(extraFixText?: string): Promise<WeekJson> {
    const timeoutMs = Number(process.env.OPENAI_WEEK_TIMEOUT_MS || 20000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let resp: Awaited<ReturnType<typeof openai.chat.completions.create>>;
    try {
      resp = await openai.chat.completions.create(
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
        }),
        { signal: controller.signal }
      );
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw new Error(`OPENAI_WEEK_TIMEOUT_${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }

    const content = resp.choices[0]?.message?.content ?? "{}";
    try {
      return JSON.parse(content) as WeekJson;
    } catch {
      const repairController = new AbortController();
      const repairTimer = setTimeout(() => repairController.abort(), timeoutMs);
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
        }),
        { signal: repairController.signal }
      ).finally(() => clearTimeout(repairTimer));
      const repaired = repairResp.choices[0]?.message?.content ?? "{}";
      return JSON.parse(repaired) as WeekJson;
    }
  }

  // First attempt
  let currentWeek: WeekJson;
  try {
    currentWeek = await callLLM();
  } catch (err: any) {
    if (isRunPlan && targets) {
      console.warn('[generateWeek] llm first-attempt failed, using deterministic fallback', {
        weekLabel: weekMeta.label,
        error: err?.message,
      });
      const preferredLongRunDay = (userParams.trainingPrefs?.longRunDay ?? 0) as DayOfWeek;
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
    throw err;
  }

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

      console.warn('[generateWeek] validation reroll', {
        weekLabel: weekMeta.label,
        attempt: attempt + 1,
        errorCount: v.errors.length,
        safetyCriticalCount: safetyCritical.length,
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

      const fix = `CORRECTION: your previous output violated hard rules.

Failures:
- ${topIssues.join("\n- ")}

You must regenerate and satisfy ALL constraints:
- Weekly minutes target: ${targets.targetWeeklyMin} (±5%)
- Long run target: ${targets.targetLongRunMin} (must be within tolerance)
- Long run minimum floor: ${targets.minLongRunMin ?? 0}
- Long run maximum: ${targets.longRunMax}
- Max single run duration: ${targets.maxSingleRunMin ?? 'n/a'}
- Hard days ≤ ${targets.qualityDays}
- Total hard-run minutes ≤ ${targets.maxQualityMin}
- Longest run must land on preferred long run day (${preferredLongRunDay})
- Respect monotony guards (duration variety, no excessive long sessions)

Return complete JSON week object only, with all 7 day keys for the requested week.${previousWeekBlock}`;

      try {
        currentWeek = await callLLM(fix);
      } catch (err: any) {
        console.warn('[generateWeek] reroll failed, switching to deterministic fallback', {
          weekLabel: weekMeta.label,
          attempt: attempt + 1,
          error: err?.message,
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

    const finalSafetyErrors = finalValidation.errors;
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
