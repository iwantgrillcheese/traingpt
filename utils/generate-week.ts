// utils/generate-week.ts
import OpenAI from 'openai';
import { COACH_SYSTEM_PROMPT } from '@/lib/coachPrompt';
import { buildCoachPrompt } from './buildCoachPrompt';
import { buildRunningPrompt } from './buildRunningPrompt';
import type { WeekMeta, UserParams, WeekJson, PlanType } from '@/types/plan';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function generateWeek({
  weekMeta,
  userParams,
  planType = 'triathlon',
  index, // ← optional
}: {
  weekMeta: WeekMeta;
  userParams: UserParams;
  planType?: PlanType;
  index?: number;
}): Promise<WeekJson> {
  const userMsg =
    planType === 'running'
      ? buildRunningPrompt({ userParams, weekMeta, index })
      : buildCoachPrompt({ userParams, weekMeta, index });

  const resp = await openai.chat.completions.create({
    model: process.env.PLAN_MODEL ?? 'gpt-4o',
    temperature: 0.2,
    top_p: 1,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: COACH_SYSTEM_PROMPT },
      { role: 'user', content: userMsg },
    ],
  });

  const content = resp.choices[0]?.message?.content ?? '{}';
  return JSON.parse(content) as WeekJson;
}
