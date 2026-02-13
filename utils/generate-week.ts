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
    return JSON.parse(content) as WeekJson;
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

    // Give the model multiple correction attempts and keep the best candidate by error count.
    for (let attempt = 0; attempt < 5; attempt++) {
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

    // If still failing after rerolls, return the best candidate seen.
    return bestWeek;
  }

  return currentWeek;
}
