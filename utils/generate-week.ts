import OpenAI from 'openai';
import { COACH_SYSTEM_PROMPT } from '@/lib/coachPrompt';
import { buildCoachPrompt } from '@/utils/buildCoachPrompt';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type WeekMeta = {
  label: string;
  phase: string;
  deload: boolean;
  startDate: string; // ISO string
};

type UserParams = {
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

Only return a single structured week. Title the week and include 6–7 well-formatted sessions.
`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    messages: [{ role: 'system', content: prompt }],
  });

  return completion.choices[0].message.content ?? '';
}
