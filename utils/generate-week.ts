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

  // Running-only targets + prompt
  const targets = isRunPlan
    ? computeRunTargets({ userParams, weekMeta, weekIndex: index ?? 0, prevWeek })
    : null;

  const userMsg = isRunPlan
    ? buildRunningPrompt({
        userParams,
        weekMeta,
        index,
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
    : buildCoachPrompt({ userParams, weekMeta, index });

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

  const week1 = await callLLM();

  // Running-only validation + one reroll
  if (isRunPlan && targets) {
    const preferredLongRunDay = (userParams.trainingPrefs?.longRunDay ?? 0) as DayOfWeek;

    const v1 = validateRunWeek({
      week: week1,
      userParams,
      weekMeta: { deload: weekMeta.deload },
      targets: {
        targetWeeklyMin: targets.targetWeeklyMin,
        longRunMax: targets.longRunMax,
        qualityDays: targets.qualityDays,
        preferredLongRunDay,
      },
      prevWeek,
    });

    if (!v1.ok) {
      const fix = `Regenerate the week to satisfy ALL Weekly Targets and rules.
Problems detected:
- ${v1.errors.join("\n- ")}
Important: Every run must include duration and longest run must be on the preferred long run day.`;

      const week2 = await callLLM(fix);
      return week2;
    }
  }

  return week1;
}
