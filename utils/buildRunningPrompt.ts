// utils/buildRunningPrompt.ts
import type { WeekMeta, UserParams } from '@/types/plan';

const dayName = (d: number) =>
  ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d];

export function buildRunningPrompt({
  userParams,
  weekMeta,
  index, // optional for compatibility
}: {
  userParams: UserParams;
  weekMeta: WeekMeta;
  index?: number;
}) {
  const prefs = userParams.trainingPrefs ?? {};
  const longRunDay  = prefs.longRunDay  ?? 0; // default Sunday

  return `
You are creating ${weekMeta.label} for a running plan.

## Athlete
- Race: ${userParams.raceType}
- Race Date: ${userParams.raceDate}
- Experience: ${userParams.experience}
- Max Weekly Hours: ${userParams.maxHours}
- Rest Day: ${userParams.restDay}

## Week
- Label: ${weekMeta.label}
- Phase: ${weekMeta.phase}
- Start Date: ${weekMeta.startDate}
- Deload: ${weekMeta.deload ? 'Yes' : 'No'}

## Preferences
- Long Run Day: ${dayName(longRunDay)} (${longRunDay})

## Metrics
- Run Threshold Pace: ${userParams.runPace ?? 'unknown'}

## Instructions
- Generate 5–6 sessions plus the Rest Day, appropriate to the phase.
- Emphasize progressive aerobic development with appropriate quality (tempo/intervals) and recovery.
- Return ONLY valid JSON matching the schema in the system message.
`.trim();
}
