import type { SecondaryEvent, UserParams, WeekJson } from '@/types/plan';
import { SchedulingConflict } from './sportAvailability.ts';
import { allocateTriathlonWeek, usefulMinimum } from './triathlonWeekBudget.ts';

const DAY = 86_400_000;
const difference = (a: string, b: string) => Math.round((Date.parse(a + 'T12:00:00Z') - Date.parse(b + 'T12:00:00Z')) / DAY);
const isTri = (type: string) => /tri|sprint|olympic|70\.3|ironman|140\.6/i.test(type);
const isMarathon = (type: string) => /^marathon$/i.test(type.trim());

export function normalizeSecondaryEvent(value: unknown, primary: { raceType: string; raceDate: string; maxHours: number }): SecondaryEvent | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) throw new SchedulingConflict('Add one secondary event with a race type and date.');
  const record = value as Record<string, unknown>;
  const raceType = String(record.raceType ?? '').trim();
  const raceDate = String(record.raceDate ?? '');
  const validTypes = ['5k', '10k', 'Half Marathon', 'Marathon', 'Sprint', 'Olympic', 'Sprint Triathlon', 'Olympic Triathlon', 'Half Ironman (70.3)', 'Ironman', 'Ironman (140.6)'];
  if (!validTypes.some(type => type.toLowerCase() === raceType.toLowerCase()) || !/^\d{4}-\d{2}-\d{2}$/.test(raceDate)
    || !Number.isFinite(Date.parse(raceDate)) || new Date(raceDate).toISOString().slice(0,10) !== raceDate) throw new SchedulingConflict('Choose a supported secondary race type and valid date.');
  if (!isTri(primary.raceType) && isTri(raceType)) throw new SchedulingConflict('A running-primary plan cannot prepare swim and bike for a triathlon. Make the triathlon your primary event.');
  const gap = Math.abs(difference(raceDate, primary.raceDate));
  const demanding = isMarathon(raceType) || isMarathon(primary.raceType) || /70\.3|ironman|140\.6/i.test(raceType + primary.raceType);
  if (gap < (demanding ? 21 : 7)) throw new SchedulingConflict('These races are too close for this integrated plan to provide recovery and taper. Move one event or remove the secondary event.');
  if (gap < 42 && record.primaryPriorityConfirmed !== true) throw new SchedulingConflict('These races are close. Confirm that the primary event takes priority and the secondary event is a controlled effort.');
  if (isTri(primary.raceType) && isMarathon(raceType) && primary.maxHours < 8) throw new SchedulingConflict('A triathlon plus marathon conflicts with fewer than 8 weekly hours. Increase your realistic time budget or choose one event.');
  return { raceType, raceDate, priority: 'secondary', primaryPriorityConfirmed: record.primaryPriorityConfirmed === true };
}

type Workout = Exclude<WeekJson['days'][string][number], string>;

/** One integrated schedule. Never adds marathon workouts on top of triathlon volume. */
export function integrateSecondaryEvent(weeks: WeekJson[], params: UserParams): WeekJson[] {
  const event = params.secondaryEvent;
  if (!event) return weeks;
  const result = JSON.parse(JSON.stringify(weeks)) as WeekJson[];
  const marathon = isMarathon(event.raceType);
  const lastRace = event.raceDate > params.raceDate ? event.raceDate : params.raceDate;
  let previousLong = 0;
  for (const week of result) {
    const until = difference(event.raceDate, week.startDate);
    const afterPrimary = difference(week.startDate, params.raceDate);
    const raceWeek = until >= 0 && until < 7;
    const recovery = (until < 0 && until >= -14) || (afterPrimary > 0 && afterPrimary <= 14);
    const taper = !recovery && until >= 7 && until <= (marathon ? 21 : 14);
    const primaryTaper = /taper/i.test(week.phase);
    const workouts = Object.values(week.days).flat().filter((item): item is Workout => typeof item !== 'string' && item.type !== 'race_day');
    if (marathon && !raceWeek && !recovery && !taper && !primaryTaper && !week.deload) {
      const long = workouts.find(item => item.type === 'long_run');
      // Transfer at most 20 minutes from non-anchor support, preserving swims
      // and the long ride. Progress the long run by no more than 10min/week.
      if (long && (long.durationMinutes ?? 0) > 0) {
        const baseline = long.durationMinutes!;
        const target = Math.min(150, baseline + 20, previousLong > 0 ? previousLong + 10 : baseline);
        let needed = Math.max(0, target - baseline);
        let transferred = 0;
        for (const donor of workouts.filter(item => item !== long && item.sport !== 'swim' && item.priority !== 'anchor' && item.type !== 'brick_run')) {
          const take = Math.min(needed, Math.max(0, (donor.durationMinutes ?? 0) - usefulMinimum(donor)));
          donor.durationMinutes = (donor.durationMinutes ?? 0) - take;
          transferred += take; needed -= take;
          if (!needed) break;
        }
        long.durationMinutes = baseline + transferred;
        long.details = `Purpose: Build run durability for ${event.raceType} while protecting the primary ${params.raceType}.\nWorkout: ${long.durationMinutes}min easy conversational running. Practice fueling; do not add race-pace intensity.\nCoach note: Run volume is reallocated within the existing weekly budget.`;
      }
    }
    if (raceWeek || taper || recovery) {
      const factor = recovery ? 0.5 : raceWeek ? 0.4 : 0.7;
      week.phase = recovery ? 'Recovery' : 'Taper';
      week.deload = recovery;
      for (const [date, items] of Object.entries(week.days)) {
        if (raceWeek && difference(date, event.raceDate) > 0) { week.days[date] = []; continue; }
        week.days[date] = items.map(item => {
          if (typeof item === 'string' || item.type === 'race_day') return item;
          const duration = Math.max(10, Math.floor((item.durationMinutes ?? 20) * factor / 5) * 5);
          return { ...item, durationMinutes: Math.min(item.durationMinutes ?? duration, duration),
            type: item.sport === 'run' ? 'run_easy' : item.sport === 'bike' ? 'bike_endurance' : item.type,
            title: item.sport === 'run' ? 'Run Easy' : item.sport === 'bike' ? 'Bike Endurance' : item.title,
            details: `Purpose: ${recovery ? 'Protect recovery after the event' : 'Reduce fatigue before the secondary event'}.\nWorkout: ${duration}min easy ${item.sport}. Keep effort conversational.\nCoach note: Primary event remains the priority.` };
        });
      }
    }
    if (raceWeek) week.days[event.raceDate] = [{ sport: 'other', title: `Secondary Race: ${event.raceType}`, type: 'race_day', priority: 'anchor',
      details: `Secondary event: ${event.raceType}. ${event.primaryPriorityConfirmed ? 'Treat this as a controlled effort; the primary event takes priority.' : 'Use practiced pacing and fueling; allow recovery afterward.'}` }];
    // Remove training after the final event and cap post-event rebuilding.
    for (const date of Object.keys(week.days)) if (date > lastRace) week.days[date] = [];
    const training = Object.values(week.days).flat().filter((item): item is Workout => typeof item !== 'string' && item.type !== 'race_day');
    // The scaffold already provides absolute-week progression. A deload must
    // never become the baseline for all following normal weeks. Rebuilding
    // after an actual event is explicit and date-based, independent of deloads.
    const sinceEvent = Math.min(...[difference(week.startDate, params.raceDate), difference(week.startDate, event.raceDate)].filter(days => days > 0));
    if (!raceWeek && !taper && !recovery && !primaryTaper && sinceEvent > 14 && sinceEvent <= 28) {
      const factor = sinceEvent <= 21 ? 0.75 : 0.9;
      for (const item of training) {
        item.durationMinutes = Math.max(usefulMinimum(item), Math.round((item.durationMinutes ?? 0) * factor));
      }
      week.debug = [week.debug, `Deliberate post-event rebuilding at ${Math.round(factor * 100)}% of scaffold; normal progression resumes after four weeks.`].filter(Boolean).join('\n');
    }
    if (!week.deload && !primaryTaper && !raceWeek && !taper && !recovery) {
      previousLong = Math.max(0, ...training.filter(item => item.type === 'long_run').map(item => item.durationMinutes ?? 0));
    }
    // Keep prescriptions consistent after donor reductions / rebuilding caps.
    for (const item of training) if (item.durationMinutes) {
      if (/Run volume is reallocated/.test(item.details ?? '')) item.details = item.details!.replace(/Workout: \d+min/, `Workout: ${item.durationMinutes}min`);
      else item.details = `Workout: ${item.durationMinutes}min total.\n${String(item.details ?? '').replace(/Workout:[^\n]*/g, '').trim()}`;
    }
  }
  return isTri(params.raceType) ? result.map(week => allocateTriathlonWeek(week, params.maxHours * 60)) : result;
}
