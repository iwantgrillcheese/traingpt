import { addDays, formatISO, isValid, parseISO } from 'date-fns';
import type { UserParams, WeekJson, WeekMeta } from '@/types/plan';

type ScaffoldSport = 'swim' | 'bike' | 'run' | 'strength';

type ScaffoldSession = {
  sport: ScaffoldSport;
  title: string;
  details: string;
  type:
    | 'swim_technique'
    | 'swim_endurance'
    | 'bike_endurance'
    | 'bike_quality'
    | 'long_ride'
    | 'run_easy'
    | 'run_quality'
    | 'long_run'
    | 'brick_run'
    | 'strength';
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

function isoDate(date: Date) {
  return formatISO(date, { representation: 'date' });
}

function dayNameToIndex(day?: string | null): number | null {
  if (!day) return null;
  const cleaned = day.trim().toLowerCase();
  const index = DAY_NAMES.findIndex((name) => name.toLowerCase() === cleaned);
  return index >= 0 ? index : null;
}

function dateForJsDay(weekStartISO: string, jsDay: number): string | null {
  const start = parseISO(weekStartISO);
  if (!isValid(start)) return null;

  // weekStartISO is expected to be Monday. JS day: Sunday = 0 ... Saturday = 6.
  const mondayBasedOffset = jsDay === 0 ? 6 : jsDay - 1;
  return isoDate(addDays(start, mondayBasedOffset));
}

function canonicalWeekDates(weekStartISO: string): string[] {
  const start = parseISO(weekStartISO);
  if (!isValid(start)) return [];
  return Array.from({ length: 7 }, (_, index) => isoDate(addDays(start, index)));
}

function isTriathlonRace(raceType: string) {
  return /tri|sprint|olympic|70\.3|half iron|ironman/i.test(raceType);
}

function raceFamily(raceType: string): 'sprint' | 'olympic' | 'half' | 'ironman' | 'triathlon' {
  const lower = raceType.toLowerCase();
  if (lower.includes('70.3') || lower.includes('half iron')) return 'half';
  if (lower.includes('ironman')) return 'ironman';
  if (lower.includes('olympic')) return 'olympic';
  if (lower.includes('sprint')) return 'sprint';
  return 'triathlon';
}

function phaseIntensity(phase: string, deload: boolean) {
  const lower = phase.toLowerCase();
  if (deload || lower.includes('recovery')) return 'recovery';
  if (lower.includes('taper')) return 'taper';
  if (lower.includes('peak')) return 'peak';
  if (lower.includes('build')) return 'build';
  return 'base';
}

function getLongRideDetails(userParams: UserParams, weekMeta: WeekMeta) {
  const family = raceFamily(userParams.raceType);
  const phase = phaseIntensity(weekMeta.phase, weekMeta.deload);

  if (phase === 'taper') return 'Aerobic long ride with reduced volume. Keep the effort mostly Z2 and finish feeling fresh.';
  if (family === 'half') return 'Aerobic long ride for 70.3 durability. Ride mostly Z2 with a controlled steady finish if feeling good.';
  if (family === 'ironman') return 'Long aerobic ride focused on fueling practice, steady pacing, and staying relaxed for the full duration.';
  if (family === 'sprint' || family === 'olympic') return 'Aerobic endurance ride with a few controlled race-effort segments. Keep the final 10min smooth.';
  return 'Aerobic long ride focused on durability, fueling, and controlled pacing.';
}

function getBrickRunDetails(userParams: UserParams, weekMeta: WeekMeta) {
  const phase = phaseIntensity(weekMeta.phase, weekMeta.deload);
  if (phase === 'taper') return '10-15min very easy off the bike. Keep cadence quick and effort relaxed.';
  if (phase === 'base') return '10-15min easy off the bike. Focus on smooth cadence and relaxed form, not pace.';
  if (phase === 'peak') return '20-30min controlled off the bike. Start easy, then settle into realistic race effort if fresh.';
  return '15-25min easy-to-steady off the bike. Practice transition rhythm and controlled pacing.';
}

function getLongRunDetails(userParams: UserParams, weekMeta: WeekMeta) {
  const phase = phaseIntensity(weekMeta.phase, weekMeta.deload);
  if (phase === 'taper') return 'Reduced long run. Keep it easy and relaxed with no forced pace work.';
  if (phase === 'peak') return 'Long aerobic run with controlled pacing. Keep effort sustainable and avoid turning it into a race.';
  return 'Long easy aerobic run. Stay conversational and build durability without excess fatigue.';
}

function getRunQualityDetails(userParams: UserParams, weekMeta: WeekMeta) {
  const phase = phaseIntensity(weekMeta.phase, weekMeta.deload);
  if (phase === 'recovery' || phase === 'taper') return 'Easy aerobic run with 4-6 relaxed strides if fresh. Keep the session light.';
  if (phase === 'base') return 'Controlled aerobic run with short strides. Build rhythm without heavy intensity.';
  return 'Threshold-focused run. Include a steady main set at controlled threshold effort with easy recoveries.';
}

function getBikeMidweekDetails(userParams: UserParams, weekMeta: WeekMeta) {
  const phase = phaseIntensity(weekMeta.phase, weekMeta.deload);
  if (phase === 'recovery' || phase === 'taper') return 'Easy aerobic spin. Keep cadence smooth and effort relaxed.';
  if (phase === 'base') return 'Aerobic bike with steady Z2 work. Keep effort controlled and build consistency.';
  return 'Bike strength or tempo session. Include controlled steady intervals while keeping the weekend endurance ride protected.';
}

function getSwimDetails(kind: 'Technique' | 'Endurance', userParams: UserParams, weekMeta: WeekMeta) {
  const comfort = String(userParams.swimComfort ?? '').toLowerCase();
  if (kind === 'Technique' || comfort === 'new' || comfort === 'developing') {
    return 'Technique-focused swim with easy warmup, drill work, short relaxed repeats, and smooth cooldown. Prioritize form and comfort.';
  }
  return 'Endurance swim with warmup, steady aerobic repeats, and cooldown. Keep pacing smooth and sustainable.';
}

function findAvailableDay(preferred: number, blocked: Set<number>, used: Set<number>, allowUsed = false): number {
  if (!blocked.has(preferred) && (allowUsed || !used.has(preferred))) return preferred;

  const priority = [2, 3, 4, 5, 1, 6, 0]; // Tue, Wed, Thu, Fri, Mon, Sat, Sun
  return priority.find((day) => !blocked.has(day) && (allowUsed || !used.has(day))) ?? preferred;
}

function addSession(
  days: Record<string, ScaffoldSession[]>,
  weekStartISO: string,
  jsDay: number,
  session: ScaffoldSession
) {
  const date = dateForJsDay(weekStartISO, jsDay);
  if (!date) return;
  days[date] = [...(days[date] ?? []), session];
}

function sessionKey(session: unknown) {
  if (!session || typeof session !== 'object' || Array.isArray(session)) return '';
  const record = session as Record<string, unknown>;
  return `${String(record.sport ?? '').toLowerCase()} ${String(record.title ?? '').toLowerCase()} ${String(record.details ?? '').toLowerCase()}`;
}

function usefulGeneratedDetails(session: unknown): string | null {
  if (!session || typeof session !== 'object' || Array.isArray(session)) return null;
  const record = session as Record<string, unknown>;
  const details = String(record.details ?? record.description ?? '').replace(/\s+/g, ' ').trim();
  if (!details || /^details$/i.test(details) || /^tbd$/i.test(details)) return null;
  if (details.length < 20) return null;
  return details;
}

function flattenGeneratedSessions(week: WeekJson): unknown[] {
  const days = week?.days && typeof week.days === 'object' && !Array.isArray(week.days) ? week.days : {};
  return Object.values(days).flatMap((items) => (Array.isArray(items) ? items : []));
}

function isMatchingGeneratedSession(slot: ScaffoldSession, generated: unknown) {
  const key = sessionKey(generated);
  if (!key) return false;
  const sport = slot.sport.toLowerCase();
  const title = slot.title.toLowerCase();

  if (!key.includes(sport)) return false;

  if (title.includes('long ride')) return /long ride|endurance ride|bike endurance/.test(key);
  if (title.includes('brick run')) return /brick run|off the bike|transition run/.test(key);
  if (title.includes('long run')) return /long run/.test(key);
  if (title.includes('threshold')) return /threshold|tempo|interval/.test(key);
  if (title.includes('technique')) return /technique|drill/.test(key);
  if (title.includes('endurance')) return /endurance|aerobic|steady/.test(key);

  return key.includes(title);
}

export function buildTriathlonWeekScaffold({
  userParams,
  weekMeta,
  index = 0,
}: {
  userParams: UserParams;
  weekMeta: WeekMeta;
  index?: number;
}): WeekJson | null {
  if (!isTriathlonRace(userParams.raceType)) return null;

  const weekDates = canonicalWeekDates(weekMeta.startDate);
  const days: Record<string, ScaffoldSession[]> = Object.fromEntries(weekDates.map((date) => [date, []]));

  const prefs = userParams.trainingPrefs ?? {};
  const restDay = dayNameToIndex(userParams.restDay) ?? 1;
  const longRideDay = prefs.longRideDay ?? dayNameToIndex(userParams.preferredLongRideDay) ?? 6;
  const longRunDay = prefs.longRunDay ?? dayNameToIndex(userParams.preferredLongRunDay) ?? 0;
  const unavailable = new Set((userParams.unavailableDays ?? []).map(dayNameToIndex).filter((v): v is number => v !== null));
  const blocked = new Set<number>([restDay, ...Array.from(unavailable)]);

  const used = new Set<number>();
  const phase = phaseIntensity(weekMeta.phase, weekMeta.deload);
  const isRaceWeek = Boolean(userParams.raceDate && weekDates.includes(userParams.raceDate));

  // Race week should be light and confidence-building. Do not force normal
  // long ride / brick / long run structure into race week.
  if (isRaceWeek) {
    const easySwimDay = findAvailableDay(2, blocked, used); // Tue
    addSession(days, weekMeta.startDate, easySwimDay, {
      sport: 'swim',
      title: 'Swim Easy',
      type: 'swim_technique',
      details: 'Short relaxed swim with a few smooth pickups. Keep effort easy and focus on feeling comfortable in the water.',
    });
    used.add(easySwimDay);

    const easyBikeDay = findAvailableDay(3, blocked, used); // Wed
    addSession(days, weekMeta.startDate, easyBikeDay, {
      sport: 'bike',
      title: 'Bike Easy',
      type: 'bike_endurance',
      details: 'Short aerobic spin with a few light cadence pickups. Keep the legs fresh and avoid fatigue.',
    });
    used.add(easyBikeDay);

    const easyRunDay = findAvailableDay(4, blocked, used); // Thu
    addSession(days, weekMeta.startDate, easyRunDay, {
      sport: 'run',
      title: 'Run Easy',
      type: 'run_easy',
      details: 'Short easy run with relaxed strides if fresh. Finish feeling better than you started.',
    });

    return {
      label: weekMeta.label,
      phase: weekMeta.phase,
      startDate: weekMeta.startDate,
      deload: weekMeta.deload,
      days,
    } as WeekJson;
  }

  // Key sessions. These are non-negotiable structure slots.
  const safeLongRideDay = findAvailableDay(longRideDay, blocked, used, true);
  addSession(days, weekMeta.startDate, safeLongRideDay, {
    sport: 'bike',
    title: 'Long Ride',
    type: 'long_ride',
    details: getLongRideDetails(userParams, weekMeta),
  });
  used.add(safeLongRideDay);

  // Every non-race triathlon week gets brick practice appropriate to phase/race.
  {
    addSession(days, weekMeta.startDate, safeLongRideDay, {
      sport: 'run',
      title: 'Brick Run',
      type: 'brick_run',
      details: getBrickRunDetails(userParams, weekMeta),
    });
  }

  const safeLongRunDay = findAvailableDay(longRunDay, blocked, used, true);
  addSession(days, weekMeta.startDate, safeLongRunDay, {
    sport: 'run',
    title: phase === 'taper' ? 'Run Easy' : 'Long Run',
    type: phase === 'taper' ? 'run_easy' : 'long_run',
    details: getLongRunDetails(userParams, weekMeta),
  });
  used.add(safeLongRunDay);

  // Supporting sessions.
  const swimTechniqueDay = findAvailableDay(2, blocked, used); // Tue
  addSession(days, weekMeta.startDate, swimTechniqueDay, {
    sport: 'swim',
    title: 'Swim Technique',
    type: 'swim_technique',
    details: getSwimDetails('Technique', userParams, weekMeta),
  });
  used.add(swimTechniqueDay);

  const bikeDay = findAvailableDay(4, blocked, used); // Thu
  addSession(days, weekMeta.startDate, bikeDay, {
    sport: 'bike',
    title: phase === 'build' || phase === 'peak' ? 'Bike Tempo' : 'Bike Endurance',
    type: phase === 'build' || phase === 'peak' ? 'bike_quality' : 'bike_endurance',
    details: getBikeMidweekDetails(userParams, weekMeta),
  });
  used.add(bikeDay);

  const swimEnduranceDay = findAvailableDay(5, blocked, used); // Fri
  addSession(days, weekMeta.startDate, swimEnduranceDay, {
    sport: 'swim',
    title: 'Swim Endurance',
    type: 'swim_endurance',
    details: getSwimDetails('Endurance', userParams, weekMeta),
  });
  used.add(swimEnduranceDay);

  const runQualityDay = findAvailableDay(3, blocked, used); // Wed
  addSession(days, weekMeta.startDate, runQualityDay, {
    sport: 'run',
    title: phase === 'build' || phase === 'peak' ? 'Run Threshold' : 'Run Easy',
    type: phase === 'build' || phase === 'peak' ? 'run_quality' : 'run_easy',
    details: getRunQualityDetails(userParams, weekMeta),
  });
  used.add(runQualityDay);

  // Optional strength. Keep secondary and never duplicate.
  const notes = `${userParams.athleteNotes ?? ''} ${(userParams.coachingPriorities ?? []).join(' ')}`.toLowerCase();
  const wantsStrength = /strength|lift|gym|weights/.test(notes);
  if (wantsStrength || String(userParams.experience).toLowerCase().includes('advanced')) {
    const strengthDay = findAvailableDay(3, blocked, new Set([safeLongRideDay, safeLongRunDay]), true);
    addSession(days, weekMeta.startDate, strengthDay, {
      sport: 'strength',
      title: 'Strength Core',
      type: 'strength',
      details: 'Short accessory strength session focused on core, mobility, and durability. Keep it controlled and secondary to triathlon training.',
    });
  }

  return {
    label: weekMeta.label,
    phase: weekMeta.phase,
    startDate: weekMeta.startDate,
    deload: weekMeta.deload,
    days,
  } as WeekJson;
}

export function scaffoldSummary(scaffold: WeekJson | null): string {
  if (!scaffold) return 'No deterministic scaffold provided.';
  return JSON.stringify(scaffold.days, null, 2);
}

export function applyTriathlonScaffold({
  generatedWeek,
  scaffold,
}: {
  generatedWeek: WeekJson;
  scaffold: WeekJson | null;
}): WeekJson {
  if (!scaffold) return generatedWeek;

  const generatedSessions = flattenGeneratedSessions(generatedWeek);
  const days: Record<string, ScaffoldSession[]> = {};

  for (const [date, scaffoldItems] of Object.entries(scaffold.days)) {
    const slots = (Array.isArray(scaffoldItems) ? scaffoldItems : []) as ScaffoldSession[];

    days[date] = slots.map((slot) => {
      const generatedMatch = generatedSessions.find((candidate) => isMatchingGeneratedSession(slot, candidate));
      const generatedDetails = usefulGeneratedDetails(generatedMatch);

      return {
        ...slot,
        details: generatedDetails ?? slot.details,
      };
    });
  }

  return {
    ...generatedWeek,
    label: scaffold.label,
    phase: scaffold.phase,
    startDate: scaffold.startDate,
    deload: scaffold.deload,
    days,
    debug: [
      generatedWeek.debug,
      'Applied deterministic triathlon scaffold. GPT was used for workout detail enrichment, not weekly structure.',
    ]
      .filter(Boolean)
      .join('\n'),
  } as WeekJson;
}
