import OpenAI from 'openai';
import { buildCoachPrompt } from './buildCoachPrompt';
import { buildRunningPrompt } from './buildRunningPrompt';
import { WeekMeta, UserParams } from '@/types/plan';
import type { PlanType } from '@/types/plan';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type ParsedWeek = {
  label: string;
  phase: string;
  startDate: string;
  deload: boolean;
  days: Record<string, string[]>;
  debug?: string;
};

export async function generateWeek({
  planType,
  index,
  meta,
  params,
}: {
  planType: PlanType;
  index: number;
  meta: WeekMeta;
  params: UserParams;
}): Promise<ParsedWeek> {
  const userPrompt =
    planType === 'running'
      ? buildRunningPrompt({ userParams: params, weekMeta: meta, index })
      : buildCoachPrompt({ userParams: params, weekMeta: meta, index });

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    temperature: 0.7,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
  });

  const content = response.choices[0]?.message?.content || '';

  try {
    const parsed = JSON.parse(content);
    return parsed as ParsedWeek;
  } catch (err) {
    console.error(`❌ Failed to parse GPT response for week ${index + 1}`, content);
    throw new Error(`Failed to parse GPT response: ${err}`);
  }
}
