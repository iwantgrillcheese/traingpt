import OpenAI from 'openai';
import { COACH_SYSTEM_PROMPT } from '@/lib/coachPrompt';
import { buildCoachPrompt } from './buildCoachPrompt';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type WeekMeta = {
  label: string;
  phase: string;
  deload: boolean;
  startDate: string;
};

export type UserParams = {
  raceType: string;
  raceDate: Date;
  startDate: Date;
  totalWeeks: number;
  experience: string;
  maxHours: number;
  restDay: string;
  bikeFTP: string | null;
  runPace: string | null;
  swimPace: string | null;
  userNote: string;
};

export async function generateWeek({
  index,
  meta,
  params,
}: {
  index: number;
  meta: WeekMeta;
  params: UserParams;
}) {
  const coachPrompt = buildCoachPrompt({
    raceType: params.raceType,
    raceDate: params.raceDate,
    startDate: params.startDate,
    totalWeeks: params.totalWeeks,
    experience: params.experience,
    maxHours: params.maxHours,
    restDay: params.restDay,
    bikeFTP: params.bikeFTP ?? '',
    runPace: params.runPace ?? '',
    swimPace: params.swimPace ?? '',
    userNote: params.userNote ?? '',
    weekMeta: [meta],
  });

  const prompt = `
${COACH_SYSTEM_PROMPT}

Your job is to generate a detailed training plan for week ${index + 1}.

## Week Metadata
- Label: ${meta.label}
- Phase: ${meta.phase}
- Start Date: ${meta.startDate}
- Deload Week: ${meta.deload ? 'Yes' : 'No'}

## Athlete Info
${coachPrompt}

Return only a JSON object like the following:
{
  "label": "${meta.label}",
  "phase": "${meta.phase}",
  "startDate": "${meta.startDate}",
  "deload": ${meta.deload},
  "days": {
    "YYYY-MM-DD": ["Workout 1", "Workout 2"]
  },
  "debug": "🔥 CHUNKED WEEK ${index + 1} GENERATED @ ${new Date().toISOString()}"
}
`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    messages: [{ role: 'system', content: prompt }],
    temperature: 0.7,
  });

  try {
    const json = JSON.parse(completion.choices[0].message.content || '');
    return json;
  } catch (err) {
    console.error('❌ Failed to parse GPT response for week', index + 1, completion.choices[0]);
    throw err;
  }
}
