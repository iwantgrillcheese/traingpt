import { WeekMeta, UserParams } from '@/types/plan';

export function buildRunningPrompt({
  userParams,
  weekMeta,
  index,
}: {
  userParams: UserParams;
  weekMeta: WeekMeta;
  index: number;
}): string {
  return `
You are a world-class running coach generating week ${index + 1} of a ${userParams.raceType} training plan.

## Athlete Profile
- Race Type: ${userParams.raceType}
- Race Date: ${userParams.raceDate.toISOString().split('T')[0]}
- Experience Level: ${userParams.experience}
- Max Training Hours per Week: ${userParams.maxHours}
- Rest Day: ${userParams.restDay || 'Not specified'}

## Week Details
- Week Label: ${weekMeta.label}
- Phase: ${weekMeta.phase}
- Start Date: ${weekMeta.startDate}
- Deload Week: ${weekMeta.deload ? 'Yes' : 'No'}

## Performance Metrics
${userParams.runPace ? `- Run Threshold Pace: ${userParams.runPace} per mile` : '- No run pace provided'}

## Instructions
- Generate 5–6 runs per week, depending on volume and experience.
- Include at least one full rest day.
- Include a mix of easy runs, long runs, strides, and (if appropriate) tempo or intervals.
- Scale intensity and distance to the athlete's experience and plan phase.
- Avoid overloading volume in deload weeks.
- Format your output as strict JSON, exactly like this example:

{
  "label": "${weekMeta.label}",
  "phase": "${weekMeta.phase}",
  "startDate": "${weekMeta.startDate}",
  "deload": ${weekMeta.deload},
  "days": {
    "YYYY-MM-DD": ["Run: 45min easy", "Strides: 4x20sec"],
    ...
  },
  "debug": "This is week ${index + 1} of a ${userParams.raceType} running plan."
}

Return **only** valid JSON — no explanations or extra text.
  `.trim();
}
