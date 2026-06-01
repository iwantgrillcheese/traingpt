// utils/buildCoachPrompt.ts
import type { DayOfWeek, WeekMeta, UserParams } from '@/types/plan';
import { buildTriathlonWeekScaffold, scaffoldSummary } from './buildTriathlonScaffold';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

function dayLabel(day?: DayOfWeek | null): string {
  if (typeof day === 'number') return DAY_NAMES[day] ?? String(day);
  if (typeof day === 'string' && day.trim()) return day.trim();
  return 'not specified';
}

function dayDebug(day?: DayOfWeek | null): string {
  if (day === undefined || day === null || day === '') return 'not specified';
  return String(day);
}

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
  totalWeeks,
}: {
  userParams: UserParams;
  weekMeta: WeekMeta;
  index?: number;
  totalWeeks?: number;
}) {
  const prefs = userParams.trainingPrefs ?? {};
  const longRideDay = prefs.longRideDay ?? 6; // default Saturday
  const longRunDay  = prefs.longRunDay  ?? 0; // default Sunday
  const brickDays   = (prefs.brickDays?.length ? prefs.brickDays : [6]); // default Saturday
  const scaffold = buildTriathlonWeekScaffold({ userParams, weekMeta, index, totalWeeks });

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
- Plan Week: ${(index ?? 0) + 1} of ${totalWeeks ?? 'unknown'}
- Deload: ${weekMeta.deload ? 'Yes' : 'No'}

## Deterministic Week Scaffold
The weekly structure below is the source of truth. Do not move, add, or remove sessions. Fill the existing slots with useful details only.
${scaffoldSummary(scaffold)}

## Scheduling Preferences and Constraints
- Long Ride Day: ${userParams.preferredLongRideDay ? dayLabel(userParams.preferredLongRideDay) : dayLabel(longRideDay)} (${dayDebug(longRideDay)})
- Long Run Day: ${userParams.preferredLongRunDay ? dayLabel(userParams.preferredLongRunDay) : dayLabel(longRunDay)} (${dayDebug(longRunDay)})
- Brick Allowed Day(s): ${brickDays.map(dayLabel).join(', ')} (${brickDays.map(dayDebug).join(',')})
- Rest Day: ${userParams.restDay}
- Unavailable Days: ${listOrNone(userParams.unavailableDays)}
- Two-a-days allowed: ${yesNo(userParams.twoADaysAllowed)}

## Athlete Context From Onboarding
- Swim comfort: ${userParams.swimComfort ?? 'not specified'}
- Coaching priorities: ${listOrNone(userParams.coachingPriorities)}
- Athlete notes: ${userParams.athleteNotes?.trim() || 'none'}
- Parsed constraints summary: ${userParams.constraintsSummary?.trim() || 'none'}

## Metrics
- Bike FTP: ${userParams.bikeFtp ?? userParams.bikeFTP ?? 'unknown'}
- Run Threshold Pace: ${userParams.runPace ?? 'unknown'}
- Swim CSS: ${userParams.swimPace ?? 'unknown'}

## Recent Strava History (optional context)
${userParams.stravaHistorySummary ? userParams.stravaHistorySummary : 'No recent Strava data available. Build from goals and experience defaults.'}

## Instructions
- CRITICAL: Follow the Deterministic Week Scaffold exactly for dates, sports, session titles, type, priority, and durationMinutes. The scaffold already encodes race-specific dynamic duration progression across the full plan. GPT's job is to enrich workout details, not decide the weekly skeleton or duration progression.
- Generate a realistic week for the athlete's stated max hours. Most 70.3 weeks should have 6–9 total sessions, not 10–12+ unless the athlete explicitly supports that load. Do not add sessions beyond the scaffold; enrich the scaffolded sessions only. Do not change durationMinutes.
- IMPORTANT: Brick workouts are REQUIRED in every triathlon plan. A brick is not a sport value; it is a same-day bike + run pairing. Represent each brick as TWO sessions on the same date: the existing Long Ride plus one short Run session. Example: { "sport": "bike", "title": "Long Ride", "details": "2h Z2..." } and { "sport": "run", "title": "Brick Run", "details": "15min easy off the bike..." }. Do not create a separate "Brick Bike" session when Long Ride already exists. Never output sport/title text where the sport itself is "brick".
- Brick frequency rule: Sprint/Olympic plans need periodic brick runs; 70.3 and Ironman plans need brick runs in most Build/Peak weeks and some Base weeks. The brick run should usually follow the long ride on the preferred long ride day. The bike portion should usually BE the long ride. Do not add a separate endurance bike, threshold bike, and brick bike on the same day.
- Day loading rule: do not schedule more than two endurance sessions on the same day, except a bike + short brick run. Never schedule three bike sessions on one day.
- Strength rule: strength is accessory work. Cap it at three short sessions per week, never put two strength sessions on the same day, and avoid heavy lower-body strength before key run/ride sessions.
- Treat Scheduling Preferences and Constraints as hard constraints unless they are unsafe or impossible.
- Place long ride/run/brick according to the preferred days above. The selected rest day overrides any default template. Do not add Tuesday as a habitual second rest day.
- Never schedule workouts on unavailable days unless the athlete explicitly allows it.
- If the athlete is new/developing in swim comfort, bias early weeks toward technique, consistency, and confidence before heavy swim intensity.
- Tie intensities to metrics consistently when available: bike workouts should reference FTP ranges, run workouts should use calculated target pace ranges derived from threshold pace, and swim workouts should reference swim CSS/threshold pace for controlled repeats. Do not write vague lines like "use threshold pace as a base"; translate the metric into actionable targets such as easy pace, steady pace, or threshold-rep range.
- If Strava history exists, use it to calibrate starting load and discipline balance while still honoring race goals.
- Session titles must be concise, calendar-friendly labels of 2–4 words. Do NOT begin session titles with punctuation such as "—", "–", "-", ":", bullets, or emoji.
- Do NOT put duration, pace, FTP, interval prescriptions, yardage, or long explanations in the title. Put those specifics in details/description.
- Good title examples: "Run Easy", "Run Threshold", "Long Run", "Bike Endurance", "Bike Threshold", "Long Ride", "Swim Technique", "Swim Endurance", "Strength", "Brick Run".
- Bad title examples: "Threshold — 50min including 5x5min", "Long — 1h45 at 8:00-8:30/mi", "Technique — 2000m drills focusing on stroke efficiency".
- Preferred output shape for each session item inside days: an object with { sport, title, durationMinutes, details, type }. Preserve the scaffold's type and durationMinutes exactly. The title must be short and the details must contain the actual prescription. Return the same dates and same number of session slots as the scaffold.
- Do not output placeholder details such as "Details", "Details Details", "TBD", "Not specified", or repeated labels. Details must be useful enough for an athlete to execute the workout.
- Example session object: { "sport": "run", "title": "Run Threshold", "details": "50min total. Main set: 5x5min near threshold with 2min easy jog recoveries. Keep the final rep controlled." }
- Example swim object: { "sport": "swim", "title": "Swim Technique", "details": "1500m total with 300m easy warmup, 8x50m drills, 6x100m smooth aerobic, 200m cooldown." }
- Every non-rest session must include useful detail/description. Details should include the scaffold duration, purpose, and a clear prescription an athlete can execute within that duration. For swim sessions, always include set structure. For bike/run quality sessions, include the main set or intensity target in details, not the title. For easy and long runs, include an actual easy/steady target range when threshold pace is known; do not merely mention that threshold pace exists.
- Return ONLY valid JSON matching the schema in the system message.
`.trim();
}
