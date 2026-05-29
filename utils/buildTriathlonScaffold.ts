import { addDays, differenceInCalendarDays, formatISO, isValid, parseISO } from 'date-fns';
import type { UserParams, WeekJson, WeekMeta } from '@/types/plan';

type ScaffoldSport = 'swim' | 'bike' | 'run' | 'strength' | 'other';

type ScaffoldSession = {
  sport: ScaffoldSport;
  title: string;
  details: string;
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

type PhaseKind = 'base' | 'build' | 'peak' | 'taper' | 'recovery';
type RaceFamily = 'sprint' | 'olympic' | 'half' | 'ironman' | 'triathlon';

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

function dayIndexForDate(dateISO?: string | null): number | null {
  if (!dateISO) return null;
  const parsed = parseISO(dateISO);
  if (!isValid(parsed)) return null;
  return parsed.getDay();
}

function isTriathlonRace(raceType: string) {
  return /tri|sprint|olympic|70\.3|half iron|ironman|140\.6/i.test(raceType);
}

function raceFamily(raceType: string): RaceFamily {
  const lower = raceType.toLowerCase();
  if (lower.includes('70.3') || lower.includes('half iron')) return 'half';
  if (lower.includes('ironman') || lower.includes('140.6')) return 'ironman';
  if (lower.includes('olympic')) return 'olympic';
  if (lower.includes('sprint')) return 'sprint';
  return 'triathlon';
}

function phaseKind(weekMeta: WeekMeta): PhaseKind {
  const lower = String(weekMeta.phase ?? '').toLowerCase();
  if (weekMeta.deload || lower.includes('recovery') || lower.includes('deload')) return 'recovery';
  if (lower.includes('taper')) return 'taper';
  if (lower.includes('peak')) return 'peak';
  if (lower.includes('build')) return 'build';
  return 'base';
}

function isRaceWeek(weekMeta: WeekMeta, raceDate?: string | null) {
  if (!raceDate) return false;
  const weekStart = parseISO(weekMeta.startDate);
  const race = parseISO(raceDate);
  if (!isValid(weekStart) || !isValid(race)) return false;
  const daysUntilRace = differenceInCalendarDays(race, weekStart);
  return daysUntilRace >= 0 && daysUntilRace <= 6;
}

function experienceLevel(userParams: UserParams): 'beginner' | 'intermediate' | 'advanced' {
  const exp = String(userParams.experience ?? '').toLowerCase();
  if (exp.includes('begin')) return 'beginner';
  if (exp.includes('advanced') || exp.includes('expert')) return 'advanced';
  return 'intermediate';
}

function swimComfort(userParams: UserParams): 'new' | 'developing' | 'comfortable' | 'strong' {
  const comfort = String(userParams.swimComfort ?? '').toLowerCase();
  if (comfort.includes('new') || comfort.includes('beginner')) return 'new';
  if (comfort.includes('develop')) return 'developing';
  if (comfort.includes('strong')) return 'strong';
  return 'comfortable';
}

function wantsStrength(userParams: UserParams) {
  const text = `${userParams.athleteNotes ?? ''} ${(userParams.coachingPriorities ?? []).join(' ')}`.toLowerCase();
  return /strength|lift|lifting|gym|weights|physique/.test(text);
}

function hasPriority(userParams: UserParams, pattern: RegExp) {
  const text = `${userParams.athleteNotes ?? ''} ${(userParams.coachingPriorities ?? []).join(' ')} ${userParams.constraintsSummary ?? ''}`.toLowerCase();
  return pattern.test(text);
}

function getLongRideDetails(userParams: UserParams, weekMeta: WeekMeta, index: number) {
  const family = raceFamily(userParams.raceType);
  const phase = phaseKind(weekMeta);
  const weekNum = index + 1;

  if (phase === 'taper') return 'Reduced aerobic ride. Keep effort mostly Z2, include a few short race-effort pickups only if fresh, and finish feeling sharper than when you started.';
  if (phase === 'recovery') return 'Shorter endurance ride for recovery week. Keep it conversational, relaxed, and smooth with no forced intensity.';
  if (family === 'half') return `70.3 long ride for aerobic durability. Keep most of the ride Z2; include controlled steady work only if it does not compromise the brick run. Week ${weekNum} should feel sustainable, not heroic.`;
  if (family === 'ironman') return `Ironman aerobic long ride. Prioritize fueling practice, steady pacing, and relaxed form. Week ${weekNum} should build durability without chasing power.`;
  if (family === 'sprint' || family === 'olympic') return 'Endurance ride with controlled race-effort practice. Keep the final minutes smooth so the run off the bike feels composed.';
  return 'Aerobic long ride focused on durability, fueling, and controlled pacing.';
}

function getBrickRunDetails(userParams: UserParams, weekMeta: WeekMeta) {
  const phase = phaseKind(weekMeta);
  if (phase === 'taper') return '8-12min very easy off the bike. Keep cadence quick, stay relaxed, and stop before it creates fatigue.';
  if (phase === 'recovery') return '8-10min easy transition jog off the bike. This is for rhythm only, not fitness.';
  if (phase === 'base') return '10-15min easy off the bike. Focus on quick cadence, relaxed breathing, and smooth posture. Do not chase pace.';
  if (phase === 'peak') return '20-30min controlled off the bike. Start easy, then settle into realistic race effort only if legs feel good.';
  return '15-25min easy-to-steady off the bike. Practice transition rhythm and controlled pacing without turning it into a second hard run.';
}

function getLongRunDetails(userParams: UserParams, weekMeta: WeekMeta) {
  const phase = phaseKind(weekMeta);
  if (phase === 'taper') return 'Reduced long run. Keep it easy, relaxed, and confidence-building with no forced pace work.';
  if (phase === 'recovery') return 'Shortened aerobic run for recovery week. Stay conversational and finish fresh.';
  if (phase === 'peak') return 'Long aerobic run with controlled pacing. Keep effort sustainable and avoid turning it into a race.';
  return 'Long easy aerobic run. Stay conversational and build durability without excess fatigue.';
}

function getRunQualityDetails(userParams: UserParams, weekMeta: WeekMeta) {
  const phase = phaseKind(weekMeta);
  if (phase === 'recovery' || phase === 'taper') return 'Easy aerobic run with 4-6 relaxed strides only if fresh. Keep the session light.';
  if (phase === 'base') return 'Controlled aerobic run with short relaxed strides. Build rhythm without heavy intensity.';
  if (phase === 'peak') return 'Race-specific run session. Keep the main work controlled and avoid digging a hole before the weekend key sessions.';
  return 'Threshold-focused run. Include steady controlled work near threshold effort with easy recoveries. Finish in control.';
}

function getBikeMidweekDetails(userParams: UserParams, weekMeta: WeekMeta) {
  const phase = phaseKind(weekMeta);
  if (phase === 'recovery' || phase === 'taper') return 'Easy aerobic spin. Keep cadence smooth and effort relaxed.';
  if (phase === 'base') return 'Aerobic bike with steady Z2 work. Keep effort controlled and build consistency.';
  if (phase === 'peak') return 'Race-specific bike session with controlled steady work. Keep the intensity honest but do not compromise the long ride.';
  return 'Bike strength or tempo session. Include controlled steady intervals without compromising the long ride.';
}

function getSwimDetails(kind: 'Technique' | 'Endurance' | 'Threshold', userParams: UserParams, weekMeta: WeekMeta) {
  const comfort = swimComfort(userParams);
  const phase = phaseKind(weekMeta);

  if (kind === 'Technique' || comfort === 'new' || comfort === 'developing') {
    return 'Technique-focused swim. Include easy warmup, drill work, short relaxed repeats, and smooth cooldown. Prioritize body position, breathing, and comfort over speed.';
  }

  if (kind === 'Threshold' && phase !== 'base' && phase !== 'recovery') {
    return 'Controlled swim threshold session. Include warmup, a main set of repeat efforts at strong but sustainable pace, and cooldown. Keep form intact.';
  }

  return 'Endurance swim. Include warmup, steady aerobic repeats, and cooldown. Keep pacing smooth and sustainable.';
}

function getStrengthDetails(userParams: UserParams, weekMeta: WeekMeta, kind: 'Core' | 'Full Body') {
  const phase = phaseKind(weekMeta);
  if (phase === 'taper') return 'Short mobility and activation only. Keep this light and skip anything that creates soreness.';
  if (kind === 'Core') return 'Short accessory strength session focused on core, hips, glutes, and mobility. Keep it controlled and secondary to endurance training.';
  return 'Controlled full-body strength session. Prioritize movement quality, posterior chain, core, and durability. Avoid failure or soreness before key sessions.';
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
  return `${String(record.sport ?? '').toLowerCase()} ${String(record.title ?? '').toLowerCase()} ${String(record.details ?? record.description ?? '').toLowerCase()}`;
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
  if (title.includes('tempo')) return /tempo|threshold|steady/.test(key);
  if (title.includes('technique')) return /technique|drill/.test(key);
  if (title.includes('endurance')) return /endurance|aerobic|steady/.test(key);
  if (title.includes('easy')) return /easy|recovery|aerobic/.test(key);

  return key.includes(title);
}

function addIfAvailable(
  days: Record<string, ScaffoldSession[]>,
  weekStartISO: string,
  preferred: number,
  blocked: Set<number>,
  used: Set<number>,
  session: ScaffoldSession,
  allowUsed = false
) {
  const day = findAvailableDay(preferred, blocked, used, allowUsed);
  addSession(days, weekStartISO, day, session);
  used.add(day);
  return day;
}

function removeSessionsOnBlockedDays(days: Record<string, ScaffoldSession[]>, weekMeta: WeekMeta, blocked: Set<number>) {
  for (const date of Object.keys(days)) {
    const day = dayIndexForDate(date);
    if (day !== null && blocked.has(day)) days[date] = [];
  }
}

function maybeAddRaceDay(days: Record<string, ScaffoldSession[]>, userParams: UserParams, weekMeta: WeekMeta) {
  if (!userParams.raceDate || !isRaceWeek(weekMeta, userParams.raceDate)) return false;
  if (!days[userParams.raceDate]) return false;

  days[userParams.raceDate] = [
    {
      sport: 'other',
      title: 'Race Day',
      details: `${userParams.raceType} race day. Execute calmly, fuel early, pace the bike intelligently, and stay composed on the run.`,
    },
  ];
  return true;
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

  const phase = phaseKind(weekMeta);
  const family = raceFamily(userParams.raceType);
  const exp = experienceLevel(userParams);
  const comfort = swimComfort(userParams);
  const maxHours = Number(userParams.maxHours ?? 0);
  const used = new Set<number>();
  const raceWeek = isRaceWeek(weekMeta, userParams.raceDate);

  // Hard-reset blocked days up front. Scaffold must respect user availability.
  removeSessionsOnBlockedDays(days, weekMeta, blocked);

  if (raceWeek && maybeAddRaceDay(days, userParams, weekMeta)) {
    // Race week should be short, sharp, and uncluttered.
    addIfAvailable(days, weekMeta.startDate, 2, blocked, used, {
      sport: 'swim',
      title: 'Swim Easy',
      details: 'Short relaxed swim with a few smooth pickups. Leave the pool feeling better than when you started.',
    });
    addIfAvailable(days, weekMeta.startDate, 3, blocked, used, {
      sport: 'bike',
      title: 'Bike Easy',
      details: 'Short easy spin with 3-4 relaxed cadence pickups. Keep legs fresh for race day.',
    });
    addIfAvailable(days, weekMeta.startDate, 4, blocked, used, {
      sport: 'run',
      title: 'Run Easy',
      details: 'Short relaxed run with 4 strides if fresh. Keep effort easy and confidence high.',
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
    title: phase === 'recovery' ? 'Bike Endurance' : 'Long Ride',
    details: getLongRideDetails(userParams, weekMeta, index),
  });
  used.add(safeLongRideDay);

  // Every triathlon plan gets brick practice. Recovery/taper weeks keep this very short.
  addSession(days, weekMeta.startDate, safeLongRideDay, {
    sport: 'run',
    title: 'Brick Run',
    details: getBrickRunDetails(userParams, weekMeta),
  });

  const safeLongRunDay = findAvailableDay(longRunDay, blocked, used, true);
  addSession(days, weekMeta.startDate, safeLongRunDay, {
    sport: 'run',
    title: phase === 'taper' || phase === 'recovery' ? 'Run Easy' : 'Long Run',
    details: getLongRunDetails(userParams, weekMeta),
  });
  used.add(safeLongRunDay);

  // Base week composition. Keep this sane and avoid the 10-12 session mess.
  const swimTechniqueDay = addIfAvailable(days, weekMeta.startDate, 2, blocked, used, {
    sport: 'swim',
    title: 'Swim Technique',
    details: getSwimDetails('Technique', userParams, weekMeta),
  });

  const runQualityPreferred = safeLongRunDay === 0 ? 3 : 2; // Wed when long run Sunday, otherwise Tue
  addIfAvailable(days, weekMeta.startDate, runQualityPreferred, blocked, used, {
    sport: 'run',
    title: phase === 'build' || phase === 'peak' ? 'Run Threshold' : 'Run Easy',
    details: getRunQualityDetails(userParams, weekMeta),
  });

  const bikePreferred = safeLongRideDay === 6 ? 4 : 5; // Thu normally, Fri if long ride midweek
  addIfAvailable(days, weekMeta.startDate, bikePreferred, blocked, used, {
    sport: 'bike',
    title: phase === 'build' || phase === 'peak' ? 'Bike Tempo' : 'Bike Endurance',
    details: getBikeMidweekDetails(userParams, weekMeta),
  });

  const shouldAddSecondSwim = maxHours >= 5 || family === 'half' || family === 'ironman' || comfort === 'new' || comfort === 'developing';
  if (shouldAddSecondSwim) {
    addIfAvailable(days, weekMeta.startDate, 5, blocked, used, {
      sport: 'swim',
      title: comfort === 'new' || comfort === 'developing' ? 'Swim Technique' : 'Swim Endurance',
      details: getSwimDetails('Endurance', userParams, weekMeta),
    });
  }

  const wantsSwimEmphasis = hasPriority(userParams, /swim|technique|water|pool/) || comfort === 'new' || comfort === 'developing';
  const shouldAddThirdSwim = !weekMeta.deload && phase !== 'taper' && maxHours >= 8 && wantsSwimEmphasis;
  if (shouldAddThirdSwim) {
    addIfAvailable(days, weekMeta.startDate, 1, blocked, used, {
      sport: 'swim',
      title: 'Swim Easy',
      details: 'Short easy technique swim. Keep it relaxed and use it to reinforce breathing, balance, and feel for the water.',
    });
  }

  // Optional strength. Keep secondary, never duplicate, and reduce in taper/recovery.
  const strengthRequested = wantsStrength(userParams);
  const strengthAllowed = phase !== 'taper' && maxHours >= 6 && (strengthRequested || exp === 'advanced');
  if (strengthAllowed) {
    addIfAvailable(days, weekMeta.startDate, swimTechniqueDay, blocked, new Set([safeLongRideDay, safeLongRunDay]), {
      sport: 'strength',
      title: 'Strength Core',
      details: getStrengthDetails(userParams, weekMeta, 'Core'),
    }, true);

    if (!weekMeta.deload && phase !== 'recovery' && strengthRequested && maxHours >= 9) {
      addIfAvailable(days, weekMeta.startDate, 4, blocked, new Set([safeLongRideDay, safeLongRunDay]), {
        sport: 'strength',
        title: 'Strength Full Body',
        details: getStrengthDetails(userParams, weekMeta, 'Full Body'),
      });
    }
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
      'Applied deterministic triathlon scaffold V2. Code owns structure; GPT enriches workout details only.',
    ]
      .filter(Boolean)
      .join('\n'),
  } as WeekJson;
}
