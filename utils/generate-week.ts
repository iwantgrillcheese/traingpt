// /utils/generate-week.ts
import OpenAI from 'openai';
import { COACH_SYSTEM_PROMPT } from '@/lib/coachPrompt';
import { buildCoachPrompt } from './buildCoachPrompt';
import { WeekMeta, UserParams } from '@/types/plan';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type ParsedWeek = {
  label: string;
  phase: string;
  startDate: string;
  deload: boolean;
  days: Record<string, string[]>;
  debug?: string;
};


export async function generateWeek(meta: WeekMeta, userParams: UserParams) { {
  index: number;
  meta: WeekMeta;
  params: UserParams;
}): Promise<ParsedWeek> {
  const coachPrompt = buildCoachPrompt({
    userParams: params,
    weekMeta: meta,
    index,
  });

  const prompt = `
${COACH_SYSTEM_PROMPT}

Your job is to generate a detailed training plan for **week ${index + 1}** of a multi-week triathlon program.

## Week Metadata
- Label: ${meta.label}
- Phase: ${meta.phase}
- Start Date: ${meta.startDate}
- Deload Week: ${meta.deload ? 'Yes' : 'No'}

${coachPrompt}

Return only a JSON object like the following (no explanation, no extra text):
{
  "label": "${meta.label}",
  "phase": "${meta.phase}",
  "startDate": "${meta.startDate}",
  "deload": ${meta.deload},
  "days": {
    "YYYY-MM-DD": ["Workout 1", "Workout 2"],
    ...
  },
  "debug": "🚨 DEBUG: This is week ${index + 1} — generated via generateWeek.ts"
}
`.trim();

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    temperature: 0.7,
    messages: [
      { role: 'system', content: COACH_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
  });

  const content = response.choices[0]?.message?.content || '';

  try {
    const parsed = JSON.parse(content);
    return parsed as ParsedWeek;
  } catch (err) {
    console.error('❌ Failed to parse GPT response for week', index + 1, content);
    throw new Error(`Failed to parse GPT response: ${err}`);
  }
}
