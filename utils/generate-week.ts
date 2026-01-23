// utils/generate-week.ts
import OpenAI from "openai";
import { COACH_SYSTEM_PROMPT } from "@/lib/coachPrompt";
import { RUNNING_SYSTEM_PROMPT } from "@/lib/runningPrompt";
import { buildCoachPrompt } from "./buildCoachPrompt";
import { buildRunningPrompt } from "./buildRunningPrompt";
import { computeRunTargets } from "@/utils/runTargets";
import { validateRunWeek } from "@/utils/validateRunWeek";
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
              longRunMax: targets.longRunMax,
              qualityDays: targets.qualityDays,
              maxQualityMin: targets.maxQualityMin,
              preferredLongRunDay: (userParams.trainingPrefs?.longRunDay ?? 0) as DayOfWeek,
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
    const resp = await openai.chat.completions.create({
      model: process.env.PLAN_MODEL ?? "gpt-4o",
      temperature: 0.2,
      top_p: 1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: extraFixText ? `${userMsg}\n\n## Fix Required\n${extraFixText}` : userMsg,
        },
      ],
    });

    const content = resp.choices[0]?.message?.content ?? "{}";
    return JSON.parse(content) as WeekJson;
  }

  // First attempt
  let currentWeek = await callLLM();

  // Running-only validation + rerolls (up to 3 attempts)
  if (isRunPlan && targets) {
    const preferredLongRunDay = (userParams.trainingPrefs?.longRunDay ?? 0) as DayOfWeek;

    for (let attempt = 0; attempt < 3; attempt++) {
      const v = validateRunWeek({
        week: currentWeek,
        userParams,
        weekMeta: { deload: weekMeta.deload },
        targets: {
          targetWeeklyMin: targets.targetWeeklyMin,
          targetLongRunMin: targets.targetLongRunMin,
          longRunMax: targets.longRunMax,
          qualityDays: targets.qualityDays,
          maxQualityMin: targets.maxQualityMin,
          preferredLongRunDay,
          // Optional: if you add this later, the validator will enforce it.
          // maxSingleRunMin: 45,
        },
        prevWeek,
      });

      if (v.ok) return currentWeek;

      const fix = `Regenerate the week to satisfy ALL Weekly Targets and rules.
Problems detected:
- ${v.errors.join("\n- ")}

Hard constraints:
- Weekly minutes target: ${targets.targetWeeklyMin} (±5%)
- Long run target: ${targets.targetLongRunMin} (must be within tolerance, and ≤ ${targets.longRunMax})
- Hard days ≤ ${targets.qualityDays}
- Total hard-run minutes ≤ ${targets.maxQualityMin}
- Longest run must land on preferred long run day (${preferredLongRunDay})

Important: Every run must include duration and longest run must be on the preferred long run day.`;

      currentWeek = await callLLM(fix);
    }

    // If still failing after rerolls, return last attempt (or you can throw)
    return currentWeek;
  }

  return currentWeek;
}
