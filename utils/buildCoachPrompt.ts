// utils/buildCoachPrompt.ts
import type { WeekMeta, UserParams } from '@/types/plan';

const dayName = (d: number) =>
  ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d];

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

## Preferences (honor if provided; otherwise use sensible defaults)
- Long Ride Day: ${dayName(longRideDay)} (${longRideDay})
- Long Run Day: ${dayName(longRunDay)} (${longRunDay})
- Brick Allowed Day(s): ${brickDays.map(dayName).join(', ')} (${brickDays.join(',')})

## Metrics
- Bike FTP: ${userParams.bikeFtp ?? 'unknown'}
- Run Threshold Pace: ${userParams.runPace ?? 'unknown'}
- Swim CSS: ${userParams.swimPace ?? 'unknown'}

## Instructions
- Generate 5–6 balanced sessions plus the Rest Day.
- Place long ride/run/brick according to Preferences above.
- Tie intensities to metrics when available.
- Return ONLY valid JSON matching the schema in the system message.
`.trim();
}
