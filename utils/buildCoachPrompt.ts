// utils/buildCoachPrompt.ts
import type { WeekMeta, UserParams } from '@/types/plan';

const dayName = (d: number) =>
  ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d];

function listOrNone(items?: string[]) {
  return items?.length ? items.join(', ') : 'none';
}

function yesNo(value?: boolean) {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return 'Not specified';
}

export function buildCoachPrompt({
  userParams,
  weekMeta,
  index, // optional for compatibility with older callers
}: {
  userParams: UserParams;
  weekMeta: WeekMeta;
  index?: number;
}) {
  const prefs = userParams.trainingPrefs ?? {};
  const longRideDay = prefs.longRideDay ?? 6; // default Saturday
  const longRunDay  = prefs.longRunDay  ?? 0; // default Sunday
  const brickDays   = (prefs.brickDays?.length ? prefs.brickDays : [6]); // default Saturday

  return `
You are creating ${weekMeta.label} for a ${userParams.raceType} plan.

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

## Scheduling Preferences and Constraints
- Long Ride Day: ${userParams.preferredLongRideDay ?? dayName(longRideDay)} (${longRideDay})
- Long Run Day: ${userParams.preferredLongRunDay ?? dayName(longRunDay)} (${longRunDay})
- Brick Allowed Day(s): ${brickDays.map(dayName).join(', ')} (${brickDays.join(',')})
- Rest Day: ${userParams.restDay}
- Unavailable Days: ${listOrNone(userParams.unavailableDays)}
- Two-a-days allowed: ${yesNo(userParams.twoADaysAllowed)}

## Athlete Context From Onboarding
- Swim comfort: ${userParams.swimComfort ?? 'not specified'}
- Coaching priorities: ${listOrNone(userParams.coachingPriorities)}
- Athlete notes: ${userParams.athleteNotes?.trim() || 'none'}
- Parsed constraints summary: ${userParams.constraintsSummary?.trim() || 'none'}

## Metrics
- Bike FTP: ${userParams.bikeFtp ?? 'unknown'}
- Run Threshold Pace: ${userParams.runPace ?? 'unknown'}
- Swim CSS: ${userParams.swimPace ?? 'unknown'}

## Recent Strava History (optional context)
${userParams.stravaHistorySummary ? userParams.stravaHistorySummary : 'No recent Strava data available. Build from goals and experience defaults.'}

## Instructions
- Generate 5–6 balanced sessions plus the Rest Day.
- Treat Scheduling Preferences and Constraints as hard constraints unless they are unsafe or impossible.
- Place long ride/run/brick according to the preferred days above.
- Never schedule workouts on unavailable days unless the athlete explicitly allows it.
- If the athlete is new/developing in swim comfort, bias early weeks toward technique, consistency, and confidence before heavy swim intensity.
- Tie intensities to metrics when available.
- If Strava history exists, use it to calibrate starting load and discipline balance while still honoring race goals.
- Session titles must be concise and clean. Do NOT begin session titles with punctuation such as "—", "–", "-", ":", bullets, or emoji.
- Avoid stuffing the full workout into the title. Use clear titles like "Bike Threshold", "Swim Technique", "Long Run", or "Brick Session"; put set details in the session details/description instead.
- Return ONLY valid JSON matching the schema in the system message.
`.trim();
}
