import { addDays, formatISO, isValid, parseISO } from 'date-fns';
import type { UserParams, WeekJson, WeekMeta } from '@/types/plan';

type ScaffoldSport = 'swim' | 'bike' | 'run' | 'strength' | 'other';

export type TriathlonSessionType =
  | 'race_day'
  | 'swim_technique'
  | 'swim_endurance'
  | 'swim_race_prep'
  | 'bike_endurance'
  | 'bike_quality'
  | 'long_ride'
  | 'bike_opener'
  | 'run_easy'
  | 'run_quality'
  | 'long_run'
  | 'brick_run'
  | 'run_opener'
  | 'strength';

type ScaffoldSession = {
  sport: ScaffoldSport;
  title: string;
  details: string;
  durationMinutes: number;
  type: TriathlonSessionType;
  priority?: 'anchor' | 'key' | 'support' | 'optional';
  purpose?: string;
  intensity?: string;
  coachNote?: string;
};

type RaceFamily = 'sprint' | 'olympic' | 'half' | 'ironman' | 'triathlon';
type ExperienceTier = 'beginner' | 'intermediate' | 'advanced';
type PhaseIntensity = 'base' | 'build' | 'peak' | 'taper' | 'recovery';

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
  const mondayBasedOffset = jsDay === 0 ? 6 : jsDay - 1;
  return isoDate(addDays(start, mondayBasedOffset));
}

function canonicalWeekDates(weekStartISO: string): string[] {
  const start = parseISO(weekStartISO);
  if (!isValid(start)) return [];
  return Array.from({ length: 7 }, (_, index) => isoDate(addDays(start, index)));
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

function experienceTier(experience: unknown): ExperienceTier {
  const text = String(experience ?? '').toLowerCase();
  if (text.includes('beginner') || text.includes('new')) return 'beginner';
  if (text.includes('advanced') || text.includes('competitive') || text.includes('experienced')) return 'advanced';
  return 'intermediate';
}

function phaseIntensity(phase: string, deload: boolean): PhaseIntensity {
  const lower = phase.toLowerCase();
  if (deload || lower.includes('recovery') || lower.includes('deload')) return 'recovery';
  if (lower.includes('taper')) return 'taper';
  if (lower.includes('peak')) return 'peak';
  if (lower.includes('build')) return 'build';
  return 'base';
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function numericMaxHours(value: unknown): number {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(n) && n > 0 ? n : 8;
}

function taperWeeksForRace(family: RaceFamily): number {
  if (family === 'ironman') return 3;
  if (family === 'half') return 2;
  return 1;
}

function trainingProgress(index: number, totalWeeks: number, family: RaceFamily, phase: PhaseIntensity): number {
  if (phase === 'taper') return 1;
  const taperWeeks = taperWeeksForRace(family);
  const buildWeeks = Math.max(1, totalWeeks - taperWeeks - 1);
  return clamp((index / buildWeeks) * 100, 0, 100) / 100;
}

function smoothProgress(index: number, totalWeeks: number, family: RaceFamily, phase: PhaseIntensity): number {
  const p = trainingProgress(index, totalWeeks, family, phase);
  // Ease-in curve: early weeks climb gently, later build/peak weeks reach full race-specific demand.
  return Math.pow(p, 0.8);
}

function cleanMetric(value: unknown): string | null {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text && text.toLowerCase() !== 'unknown' ? text : null;
}

function parsePaceToSeconds(value: unknown): number | null {
  const text = String(value ?? '').trim();
  const match = text.match(/(\d{1,2})\s*:\s*(\d{2})/);
  if (!match) return null;
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || seconds >= 60) return null;
  return minutes * 60 + seconds;
}

function inferRunUnit(userParams: UserParams): 'mi' | 'km' {
  if (userParams.paceUnit === 'km') return 'km';
  if (userParams.paceUnit === 'mi') return 'mi';
  const text = String(userParams.runPace ?? '').toLowerCase();
  return text.includes('/km') || text.includes('per km') ? 'km' : 'mi';
}

function formatPace(seconds: number, unit: 'mi' | 'km'): string {
  const rounded = Math.max(1, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `${minutes}:${String(secs).padStart(2, '0')}/${unit}`;
}

function runPaceRange(userParams: UserParams, addLowSeconds: number, addHighSeconds: number): string | null {
  const thresholdSeconds = parsePaceToSeconds(userParams.runPace);
  if (!thresholdSeconds) return null;
  const unit = inferRunUnit(userParams);
  return `${formatPace(thresholdSeconds + addLowSeconds, unit)}-${formatPace(thresholdSeconds + addHighSeconds, unit)}`;
}

function easyRunRange(userParams: UserParams) {
  return runPaceRange(userParams, 75, 115);
}

function steadyRunRange(userParams: UserParams) {
  return runPaceRange(userParams, 35, 65);
}

function thresholdRunRange(userParams: UserParams) {
  const thresholdSeconds = parsePaceToSeconds(userParams.runPace);
  if (!thresholdSeconds) return null;
  const unit = inferRunUnit(userParams);
  return `${formatPace(thresholdSeconds - 5, unit)}-${formatPace(thresholdSeconds + 10, unit)}`;
}

function ftpRange(ftp: unknown, low: number, high: number): string | null {
  const value = typeof ftp === 'number' && Number.isFinite(ftp) ? ftp : Number.parseFloat(String(ftp ?? ''));
  if (!Number.isFinite(value) || value <= 0) return null;
  return `${Math.round(value * low)}-${Math.round(value * high)}W (${Math.round(low * 100)}-${Math.round(high * 100)}% FTP)`;
}

function bikeCue(userParams: UserParams, low: number, high: number, fallback: string): string {
  const range = ftpRange(userParams.bikeFtp, low, high);
  return range ? `Target ${range}.` : fallback;
}

function swimCue(userParams: UserParams, fallback: string): string {
  const css = cleanMetric(userParams.swimPace);
  return css ? `${fallback} Use CSS/threshold ${css} only as a guide; stay smooth and relaxed.` : fallback;
}

function formatDuration(minutes: number): string {
  const rounded = Math.max(1, Math.round(minutes));
  if (rounded < 60) return `${rounded}min`;
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return remainder ? `${hours}h ${remainder}min` : `${hours}h`;
}

function hasDurationText(details: string): boolean {
  return /\b\d+\s*(?:min|mins|minutes|m)\b|\b\d+(?:\.\d+)?\s*h(?:r|rs|our|ours)?\b/i.test(details);
}

function withDuration(minutes: number, details: string): string {
  const clean = details.replace(/\s+/g, ' ').trim();
  if (!clean) return formatDuration(minutes);
  return hasDurationText(clean) ? clean : `${formatDuration(minutes)}. ${clean}`;
}

function sessionPurpose(type: TriathlonSessionType, family: RaceFamily): string {
  switch (type) {
    case 'long_ride':
      return family === 'half'
        ? 'Build 70.3 bike durability, pacing discipline, and fueling rhythm.'
        : family === 'ironman'
          ? 'Build long-course aerobic durability and fueling execution.'
          : 'Build bike endurance and controlled race-specific pacing.';
    case 'brick_run':
      return 'Practice running smoothly off the bike without turning it into a hard run.';
    case 'long_run':
      return 'Build durable aerobic run strength while keeping fatigue controlled.';
    case 'run_quality':
      return 'Build controlled run speed and threshold economy without compromising long-course durability.';
    case 'run_easy':
      return 'Add low-stress aerobic run volume and reinforce efficient mechanics.';
    case 'bike_quality':
      return 'Build controlled bike strength while protecting the weekend long ride.';
    case 'bike_endurance':
      return 'Add aerobic bike volume and improve steady endurance.';
    case 'swim_technique':
      return 'Improve swim mechanics, body position, breathing rhythm, and relaxed efficiency.';
    case 'swim_endurance':
      return 'Build sustainable swim endurance with smooth, repeatable pacing.';
    case 'swim_race_prep':
      return 'Stay loose and confident in the water without adding fatigue.';
    case 'strength':
      return 'Maintain durability and resilience without creating soreness for key sessions.';
    case 'bike_opener':
    case 'run_opener':
      return 'Stay sharp and loose while keeping fatigue very low.';
    case 'race_day':
      return 'Execute the race calmly with patient pacing and steady fueling.';
    default:
      return 'Complete the session with controlled effort and good form.';
  }
}

function sessionIntensity(type: TriathlonSessionType, userParams: UserParams): string {
  switch (type) {
    case 'long_ride':
      return ftpRange(userParams.bikeFtp, 0.65, 0.75) ?? 'Mostly Z2 / conversational endurance effort.';
    case 'bike_quality':
      return ftpRange(userParams.bikeFtp, 0.82, 0.9) ?? 'Controlled tempo / upper aerobic effort, not maximal.';
    case 'bike_endurance':
      return ftpRange(userParams.bikeFtp, 0.65, 0.75) ?? 'Smooth aerobic endurance effort.';
    case 'brick_run':
      return easyRunRange(userParams) ?? 'Easy to steady, always controlled off the bike.';
    case 'long_run':
      return easyRunRange(userParams) ?? 'Easy conversational aerobic effort.';
    case 'run_quality':
      return thresholdRunRange(userParams) ?? 'Controlled threshold / steady interval effort.';
    case 'run_easy':
      return easyRunRange(userParams) ?? 'Easy conversational effort.';
    case 'swim_technique':
      return cleanMetric(userParams.swimPace) ? `Technique-first; CSS ${cleanMetric(userParams.swimPace)} is a reference, not the goal.` : 'Technique-first, relaxed and smooth.';
    case 'swim_endurance':
      return cleanMetric(userParams.swimPace) ? `Aerobic repeats guided by CSS ${cleanMetric(userParams.swimPace)}.` : 'Smooth aerobic swim effort.';
    case 'strength':
      return 'Controlled, submaximal strength. Leave the gym feeling better, not crushed.';
    default:
      return 'Controlled effort.';
  }
}

function sessionCoachNote(type: TriathlonSessionType, family: RaceFamily): string {
  switch (type) {
    case 'long_ride':
      return family === 'half' || family === 'ironman'
        ? 'Fuel every 20-30 minutes and finish feeling like you could keep riding.'
        : 'Keep the last portion smooth; do not turn this into a race effort.';
    case 'brick_run':
      return 'Start deliberately easy for the first 5 minutes, then settle into rhythm.';
    case 'long_run':
      return 'This is durability work, not a fitness test. Finish controlled.';
    case 'run_quality':
      return 'Stop one rep before form breaks down. Quality beats hero pace.';
    case 'bike_quality':
      return 'Keep the hard work controlled so Saturday remains high quality.';
    case 'swim_technique':
      return 'If form falls apart, slow down and reset instead of forcing pace.';
    case 'swim_endurance':
      return 'Aim for even pacing and relaxed breathing across the set.';
    case 'strength':
      return 'Avoid heavy lower-body soreness before long ride or long run days.';
    default:
      return 'Keep the goal of the session clear and controlled.';
  }
}

function composeSessionDetails(args: {
  type: TriathlonSessionType;
  family: RaceFamily;
  durationMinutes: number;
  workout: string;
  userParams: UserParams;
}): { details: string; purpose: string; intensity: string; coachNote: string } {
  const purpose = sessionPurpose(args.type, args.family);
  const intensity = sessionIntensity(args.type, args.userParams);
  const coachNote = sessionCoachNote(args.type, args.family);
  const workout = withDuration(args.durationMinutes, args.workout);

  return {
    purpose,
    intensity,
    coachNote,
    details: [`Purpose: ${purpose}`, `Workout: ${workout}`, `Intensity: ${intensity}`, `Coach note: ${coachNote}`].join('\n'),
  };
}

type AnchorTargets = {
  longRideStart: number;
  longRidePeak: number;
  longRunStart: number;
  longRunPeak: number;
  brickStart: number;
  brickPeak: number;
};

const ANCHOR_TARGETS: Record<RaceFamily, Record<ExperienceTier, AnchorTargets>> = {
  sprint: {
    beginner: { longRideStart: 35, longRidePeak: 55, longRunStart: 20, longRunPeak: 35, brickStart: 5, brickPeak: 10 },
    intermediate: { longRideStart: 45, longRidePeak: 75, longRunStart: 25, longRunPeak: 45, brickStart: 8, brickPeak: 12 },
    advanced: { longRideStart: 55, longRidePeak: 90, longRunStart: 30, longRunPeak: 55, brickStart: 8, brickPeak: 15 },
  },
  olympic: {
    beginner: { longRideStart: 55, longRidePeak: 85, longRunStart: 30, longRunPeak: 50, brickStart: 8, brickPeak: 15 },
    intermediate: { longRideStart: 70, longRidePeak: 110, longRunStart: 40, longRunPeak: 65, brickStart: 10, brickPeak: 20 },
    advanced: { longRideStart: 80, longRidePeak: 135, longRunStart: 45, longRunPeak: 75, brickStart: 12, brickPeak: 25 },
  },
  half: {
    beginner: { longRideStart: 90, longRidePeak: 150, longRunStart: 45, longRunPeak: 80, brickStart: 10, brickPeak: 20 },
    intermediate: { longRideStart: 105, longRidePeak: 180, longRunStart: 55, longRunPeak: 95, brickStart: 12, brickPeak: 25 },
    advanced: { longRideStart: 120, longRidePeak: 210, longRunStart: 60, longRunPeak: 105, brickStart: 12, brickPeak: 30 },
  },
  ironman: {
    beginner: { longRideStart: 120, longRidePeak: 240, longRunStart: 60, longRunPeak: 115, brickStart: 10, brickPeak: 25 },
    intermediate: { longRideStart: 150, longRidePeak: 300, longRunStart: 70, longRunPeak: 135, brickStart: 12, brickPeak: 35 },
    advanced: { longRideStart: 180, longRidePeak: 330, longRunStart: 80, longRunPeak: 150, brickStart: 15, brickPeak: 45 },
  },
  triathlon: {
    beginner: { longRideStart: 55, longRidePeak: 90, longRunStart: 30, longRunPeak: 55, brickStart: 8, brickPeak: 15 },
    intermediate: { longRideStart: 75, longRidePeak: 135, longRunStart: 40, longRunPeak: 75, brickStart: 10, brickPeak: 22 },
    advanced: { longRideStart: 90, longRidePeak: 165, longRunStart: 50, longRunPeak: 90, brickStart: 12, brickPeak: 25 },
  },
};

function adjustAnchorsForTime(targets: AnchorTargets, family: RaceFamily, tier: ExperienceTier, maxHours: number): AnchorTargets {
  // Key sessions are protected. Low maxHours trims the peak modestly but does not
  // turn long-course plans into fake short-course plans. Supporting sessions should shrink first.
  const result = { ...targets };

  if (family === 'half') {
    if (maxHours < 7) result.longRidePeak = Math.max(tier === 'advanced' ? 165 : 135, Math.min(result.longRidePeak, 165));
    else if (maxHours < 9) result.longRidePeak = Math.max(tier === 'advanced' ? 180 : 150, Math.min(result.longRidePeak, 180));
    else if (maxHours < 11) result.longRidePeak = Math.max(tier === 'advanced' ? 195 : 165, Math.min(result.longRidePeak, 195));
  }

  if (family === 'ironman') {
    if (maxHours < 10) result.longRidePeak = Math.max(tier === 'advanced' ? 240 : 210, Math.min(result.longRidePeak, 240));
    else if (maxHours < 12) result.longRidePeak = Math.max(tier === 'advanced' ? 270 : 240, Math.min(result.longRidePeak, 270));
  }

  if (family === 'olympic') {
    if (maxHours < 6) result.longRidePeak = Math.max(85, Math.min(result.longRidePeak, 105));
  }

  if (family === 'sprint') {
    if (maxHours < 4) result.longRidePeak = Math.max(45, Math.min(result.longRidePeak, 65));
  }

  result.longRideStart = Math.min(result.longRideStart, result.longRidePeak - 20);
  result.longRunStart = Math.min(result.longRunStart, result.longRunPeak - 10);
  result.brickStart = Math.min(result.brickStart, result.brickPeak);
  return result;
}

function interpolate(start: number, peak: number, progress: number): number {
  return start + (peak - start) * clamp(progress * 100, 0, 100) / 100;
}

function weekReduction(phase: PhaseIntensity): number {
  if (phase === 'recovery') return 0.72;
  if (phase === 'taper') return 0.55;
  return 1;
}

function minutesForSession(
  type: TriathlonSessionType,
  userParams: UserParams,
  weekMeta: WeekMeta,
  index: number,
  totalWeeks = 16
): number {
  const family = raceFamily(userParams.raceType);
  const tier = experienceTier(userParams.experience);
  const phase = phaseIntensity(weekMeta.phase, weekMeta.deload);
  const maxHours = numericMaxHours(userParams.maxHours);
  const progress = smoothProgress(index, totalWeeks, family, phase);
  const anchors = adjustAnchorsForTime(ANCHOR_TARGETS[family][tier], family, tier, maxHours);
  const reduced = weekReduction(phase);

  if (type === 'race_day') {
    if (family === 'sprint') return 90;
    if (family === 'olympic') return 180;
    if (family === 'half') return 330;
    if (family === 'ironman') return 720;
    return 180;
  }

  if (type === 'long_ride') {
    if (phase === 'taper') return family === 'sprint' || family === 'olympic' ? 40 : family === 'half' ? 60 : 75;
    const duration = interpolate(anchors.longRideStart, anchors.longRidePeak, progress) * reduced;
    const floor = phase === 'recovery' ? anchors.longRideStart * 0.75 : anchors.longRideStart;
    return clamp(duration, floor, anchors.longRidePeak);
  }

  if (type === 'long_run') {
    if (phase === 'taper') return family === 'sprint' || family === 'olympic' ? 25 : family === 'half' ? 45 : 55;
    const duration = interpolate(anchors.longRunStart, anchors.longRunPeak, progress) * reduced;
    const floor = phase === 'recovery' ? anchors.longRunStart * 0.75 : anchors.longRunStart;
    return clamp(duration, floor, anchors.longRunPeak);
  }

  if (type === 'brick_run') {
    if (phase === 'taper') return 10;
    const duration = interpolate(anchors.brickStart, anchors.brickPeak, progress) * reduced;
    return clamp(duration, 8, anchors.brickPeak);
  }

  // Support sessions are where maxHours flexes. These shrink before anchors.
  const constrained = maxHours <= 6;
  const moderate = maxHours <= 8;

  if (type === 'strength') return phase === 'taper' || phase === 'recovery' ? 20 : constrained ? 20 : 30;
  if (type === 'bike_quality') return phase === 'taper' || phase === 'recovery' ? 35 : family === 'sprint' ? 40 : constrained ? 45 : moderate ? 55 : 65;
  if (type === 'bike_endurance') return phase === 'taper' || phase === 'recovery' ? 35 : constrained ? 35 : moderate ? 45 : 55;
  if (type === 'bike_opener') return family === 'sprint' || family === 'olympic' ? 25 : 35;
  if (type === 'run_quality') return phase === 'taper' || phase === 'recovery' ? 30 : constrained ? 35 : moderate ? 45 : 55;
  if (type === 'run_easy') return phase === 'taper' || phase === 'recovery' ? 25 : constrained ? 25 : 35;
  if (type === 'run_opener') return family === 'sprint' || family === 'olympic' ? 15 : 20;
  if (type === 'swim_technique') return phase === 'taper' || phase === 'recovery' ? 30 : constrained ? 30 : moderate ? 40 : 50;
  if (type === 'swim_endurance') return phase === 'taper' || phase === 'recovery' ? 30 : constrained ? 35 : moderate ? 45 : 60;
  if (type === 'swim_race_prep') return family === 'sprint' || family === 'olympic' ? 20 : 30;

  return 45;
}

function makeSession(
  type: TriathlonSessionType,
  sport: ScaffoldSport,
  title: string,
  rawDetails: string,
  userParams: UserParams,
  weekMeta: WeekMeta,
  index: number,
  totalWeeks?: number,
  priority: ScaffoldSession['priority'] = 'support'
): ScaffoldSession {
  const durationMinutes = minutesForSession(type, userParams, weekMeta, index, totalWeeks);
  const family = raceFamily(userParams.raceType);
  const structured = composeSessionDetails({ type, family, durationMinutes, workout: rawDetails, userParams });

  return {
    sport,
    title,
    type,
    priority,
    durationMinutes,
    details: structured.details,
    purpose: structured.purpose,
    intensity: structured.intensity,
    coachNote: structured.coachNote,
  };
}

function getLongRideDetails(userParams: UserParams, weekMeta: WeekMeta) {
  const family = raceFamily(userParams.raceType);
  const phase = phaseIntensity(weekMeta.phase, weekMeta.deload);

  if (phase === 'taper') {
    return `Reduced aerobic ride. Stay mostly easy with a few short relaxed race-effort pickups if fresh. ${bikeCue(userParams, 0.62, 0.72, 'Keep the effort clearly aerobic.')}`;
  }

  if (family === 'half') {
    return `Race-specific 70.3 endurance ride. Keep most of the ride aerobic, practice fueling every 20-30min, and finish controlled. ${bikeCue(userParams, 0.65, 0.75, 'Keep most of the ride in Z2 / conversational endurance effort.')}`;
  }

  if (family === 'ironman') {
    return `Long aerobic ride focused on steady pacing, fueling, and durable position. Do not chase power late. ${bikeCue(userParams, 0.63, 0.72, 'Keep the effort sustainable from start to finish.')}`;
  }

  if (family === 'sprint' || family === 'olympic') {
    return `Aerobic endurance ride with controlled race-effort segments. Keep the final 10min smooth. ${bikeCue(userParams, 0.7, 0.85, 'Use controlled race-effort, not all-out intensity.')}`;
  }

  return `Aerobic long ride focused on durability, fueling, and controlled pacing. ${bikeCue(userParams, 0.65, 0.75, 'Keep effort controlled and aerobic.')}`;
}

function getBrickRunDetails(userParams: UserParams, weekMeta: WeekMeta) {
  const phase = phaseIntensity(weekMeta.phase, weekMeta.deload);
  const easy = easyRunRange(userParams);
  const steady = steadyRunRange(userParams);
  const target = easy ? ` Start around ${easy}${phase === 'build' || phase === 'peak' ? ` and only progress toward ${steady ?? 'steady race effort'} if controlled` : ' or slower'}.` : '';

  if (phase === 'taper') return `Very easy transition run off the bike. Keep cadence quick, shoulders relaxed, and effort light.${target}`;
  if (phase === 'base') return `Easy transition run off the bike. Focus on quick cadence and relaxed form.${target}`;
  if (phase === 'peak') return `Controlled race-specific run off the bike. Start easy, settle gradually, and avoid forcing pace.${target}`;
  return `Easy-to-steady run off the bike. Practice transition rhythm, posture, and controlled pacing.${target}`;
}

function getLongRunDetails(userParams: UserParams, weekMeta: WeekMeta) {
  const phase = phaseIntensity(weekMeta.phase, weekMeta.deload);
  const easy = easyRunRange(userParams);
  const steady = steadyRunRange(userParams);

  if (phase === 'taper') {
    return easy
      ? `Reduced long run. Keep it easy around ${easy} or slower with no forced pace work.`
      : 'Reduced long run. Keep it easy and relaxed with no forced pace work.';
  }

  if (phase === 'build' || phase === 'peak') {
    return easy
      ? `Long aerobic run. Keep most of it around ${easy}; if controlled, finish the final 10-20min closer to steady 70.3 effort (${steady ?? 'controlled steady effort'}). Do not run threshold.`
      : 'Long aerobic run with controlled pacing. Keep effort sustainable and avoid turning it into a race.';
  }

  return easy
    ? `Long easy aerobic run. Target ${easy}, staying conversational and controlled from start to finish.`
    : 'Long easy aerobic run. Stay conversational and build durability without excess fatigue.';
}

function getRunQualityDetails(userParams: UserParams, weekMeta: WeekMeta) {
  const phase = phaseIntensity(weekMeta.phase, weekMeta.deload);
  const threshold = thresholdRunRange(userParams);
  const easy = easyRunRange(userParams);
  if (phase === 'recovery' || phase === 'taper') return easy ? `Easy aerobic run around ${easy} with 4-6 relaxed strides if fresh.` : 'Easy aerobic run with 4-6 relaxed strides if fresh.';
  if (phase === 'base') return easy ? `Controlled aerobic run around ${easy} with short relaxed strides. Build rhythm without heavy intensity.` : 'Controlled aerobic run with short strides. Build rhythm without heavy intensity.';
  return threshold ? `Threshold-focused run. Main set should stay controlled around ${threshold} with easy recoveries; stop short of straining.` : 'Threshold-focused run. Include controlled steady reps with easy recoveries.';
}

function getBikeMidweekDetails(userParams: UserParams, weekMeta: WeekMeta) {
  const phase = phaseIntensity(weekMeta.phase, weekMeta.deload);
  if (phase === 'recovery' || phase === 'taper') return `Easy aerobic spin. Keep cadence smooth and effort relaxed. ${bikeCue(userParams, 0.55, 0.68, 'Stay very comfortable.')}`;
  if (phase === 'base') return `Aerobic bike with steady Z2 work. Keep effort controlled and build consistency. ${bikeCue(userParams, 0.65, 0.75, 'Stay aerobic throughout.')}`;
  return `Bike strength / tempo session. Include controlled steady intervals while keeping the weekend long ride protected. ${bikeCue(userParams, 0.82, 0.9, 'Keep tempo controlled, not maximal.')}`;
}

function getSwimDetails(kind: 'Technique' | 'Endurance' | 'Race Prep', userParams: UserParams) {
  const comfort = String(userParams.swimComfort ?? '').toLowerCase();

  if (kind === 'Race Prep') {
    return swimCue(userParams, 'Short relaxed swim with a few smooth pickups. Focus on rhythm, breathing, and confidence.');
  }

  if (kind === 'Technique' || comfort === 'new' || comfort === 'developing') {
    return swimCue(userParams, 'Technique-focused swim. Include easy warmup, drill work, short relaxed repeats, and smooth cooldown. Prioritize body position, breathing, and comfort.');
  }

  return swimCue(userParams, 'Endurance swim. Include easy warmup, steady aerobic repeats, and cooldown. Keep pacing smooth and sustainable rather than forcing speed.');
}

function findAvailableDay(preferred: number, blocked: Set<number>, used: Set<number>, allowUsed = false): number {
  if (!blocked.has(preferred) && (allowUsed || !used.has(preferred))) return preferred;
  const priority = [2, 3, 4, 5, 1, 6, 0];
  return priority.find((day) => !blocked.has(day) && (allowUsed || !used.has(day))) ?? preferred;
}

function addSession(days: Record<string, ScaffoldSession[]>, weekStartISO: string, jsDay: number, session: ScaffoldSession) {
  const date = dateForJsDay(weekStartISO, jsDay);
  if (!date) return;
  days[date] = [...(days[date] ?? []), session];
}

function isRecoveryOrTaper(phase: PhaseIntensity) {
  return phase === 'recovery' || phase === 'taper';
}

function shouldIncludeStrength(userParams: UserParams, phase: PhaseIntensity) {
  if (phase === 'taper' || phase === 'recovery') return false;
  const notes = `${userParams.athleteNotes ?? ''} ${(userParams.coachingPriorities ?? []).join(' ')}`.toLowerCase();
  return /strength|lift|gym|weights/.test(notes) || String(userParams.experience).toLowerCase().includes('advanced');
}

function shouldIncludeRunQuality(family: RaceFamily, phase: PhaseIntensity) {
  if (phase === 'recovery' || phase === 'taper') return false;
  return family !== 'ironman' || phase === 'build' || phase === 'peak';
}

function shouldIncludeSecondSwim(userParams: UserParams, phase: PhaseIntensity) {
  if (phase === 'taper') return false;
  if (phase === 'recovery') return false;
  if (numericMaxHours(userParams.maxHours) <= 5) return false;
  return true;
}

function shouldIncludeMidweekBike(userParams: UserParams, phase: PhaseIntensity) {
  if (phase === 'taper') return false;
  if (phase === 'recovery') return numericMaxHours(userParams.maxHours) >= 7;
  return true;
}

export function buildTriathlonWeekScaffold({
  userParams,
  weekMeta,
  index = 0,
  totalWeeks = 16,
}: {
  userParams: UserParams;
  weekMeta: WeekMeta;
  index?: number;
  totalWeeks?: number;
}): WeekJson | null {
  if (!isTriathlonRace(userParams.raceType)) return null;

  const weekDates = canonicalWeekDates(weekMeta.startDate);
  const days: Record<string, ScaffoldSession[]> = Object.fromEntries(weekDates.map((date) => [date, []]));

  const prefs = userParams.trainingPrefs ?? {};
  const restDay = dayNameToIndex(userParams.restDay) ?? 1;
  const longRideDay = prefs.longRideDay ?? dayNameToIndex(userParams.preferredLongRideDay) ?? 6;
  const longRunDay = prefs.longRunDay ?? dayNameToIndex(userParams.preferredLongRunDay) ?? 0;
  const unavailableDays = (userParams.unavailableDays ?? [])
    .map((day) => dayNameToIndex(day))
    .filter((value): value is number => value !== null);
  const blocked = new Set<number>([restDay, ...unavailableDays]);

  const used = new Set<number>();
  const phase = phaseIntensity(weekMeta.phase, weekMeta.deload);
  const family = raceFamily(userParams.raceType);
  const isRaceWeek = Boolean(userParams.raceDate && weekDates.includes(userParams.raceDate));

  if (isRaceWeek) {
    const easySwimDay = findAvailableDay(2, blocked, used);
    addSession(days, weekMeta.startDate, easySwimDay, makeSession('swim_race_prep', 'swim', 'Swim Easy', getSwimDetails('Race Prep', userParams), userParams, weekMeta, index, totalWeeks, 'support'));
    used.add(easySwimDay);

    const easyBikeDay = findAvailableDay(3, blocked, used);
    addSession(days, weekMeta.startDate, easyBikeDay, makeSession('bike_opener', 'bike', 'Bike Easy', `Short aerobic spin with a few light cadence pickups. Keep the legs fresh and avoid fatigue. ${bikeCue(userParams, 0.55, 0.68, 'Stay very comfortable.')}`, userParams, weekMeta, index, totalWeeks, 'support'));
    used.add(easyBikeDay);

    const easyRunDay = findAvailableDay(4, blocked, used);
    addSession(days, weekMeta.startDate, easyRunDay, makeSession('run_opener', 'run', 'Run Easy', getRunQualityDetails(userParams, weekMeta), userParams, weekMeta, index, totalWeeks, 'support'));
    used.add(easyRunDay);

    const raceDate = userParams.raceDate;
    if (raceDate && days[raceDate]) {
      addSession(days, weekMeta.startDate, new Date(`${raceDate}T00:00:00`).getUTCDay(), makeSession('race_day', 'other', 'Race Day', `Race day for ${userParams.raceType}. Execute the plan: calm swim, controlled bike pacing, steady fueling, and patient run execution.`, userParams, weekMeta, index, totalWeeks, 'anchor'));
    }

    return { label: weekMeta.label, phase: weekMeta.phase, startDate: weekMeta.startDate, deload: weekMeta.deload, days } as WeekJson;
  }

  const safeLongRideDay = findAvailableDay(longRideDay, blocked, used, true);
  addSession(days, weekMeta.startDate, safeLongRideDay, makeSession('long_ride', 'bike', 'Long Ride', getLongRideDetails(userParams, weekMeta), userParams, weekMeta, index, totalWeeks, 'anchor'));
  used.add(safeLongRideDay);

  // Brick is modeled as the long ride plus a short same-day run. Never add a separate Brick Bike.
  addSession(days, weekMeta.startDate, safeLongRideDay, makeSession('brick_run', 'run', 'Brick Run', getBrickRunDetails(userParams, weekMeta), userParams, weekMeta, index, totalWeeks, 'key'));

  const safeLongRunDay = findAvailableDay(longRunDay, blocked, used, true);
  addSession(days, weekMeta.startDate, safeLongRunDay, makeSession(isRecoveryOrTaper(phase) ? 'run_easy' : 'long_run', 'run', isRecoveryOrTaper(phase) ? 'Run Easy' : 'Long Run', getLongRunDetails(userParams, weekMeta), userParams, weekMeta, index, totalWeeks, 'anchor'));
  used.add(safeLongRunDay);

  const swimTechniqueDay = findAvailableDay(2, blocked, used);
  addSession(days, weekMeta.startDate, swimTechniqueDay, makeSession('swim_technique', 'swim', 'Swim Technique', getSwimDetails('Technique', userParams), userParams, weekMeta, index, totalWeeks, 'support'));
  used.add(swimTechniqueDay);

  if (shouldIncludeMidweekBike(userParams, phase)) {
    const bikeDay = findAvailableDay(4, blocked, used);
    addSession(days, weekMeta.startDate, bikeDay, makeSession(phase === 'build' || phase === 'peak' ? 'bike_quality' : 'bike_endurance', 'bike', phase === 'build' || phase === 'peak' ? 'Bike Threshold' : 'Bike Endurance', getBikeMidweekDetails(userParams, weekMeta), userParams, weekMeta, index, totalWeeks, 'key'));
    used.add(bikeDay);
  }

  if (shouldIncludeSecondSwim(userParams, phase)) {
    const swimEnduranceDay = findAvailableDay(5, blocked, used);
    addSession(days, weekMeta.startDate, swimEnduranceDay, makeSession('swim_endurance', 'swim', 'Swim Endurance', getSwimDetails('Endurance', userParams), userParams, weekMeta, index, totalWeeks, 'support'));
    used.add(swimEnduranceDay);
  }

  if (shouldIncludeRunQuality(family, phase)) {
    const runQualityDay = findAvailableDay(3, blocked, used);
    addSession(days, weekMeta.startDate, runQualityDay, makeSession(phase === 'build' || phase === 'peak' ? 'run_quality' : 'run_easy', 'run', phase === 'build' || phase === 'peak' ? 'Run Threshold' : 'Run Easy', getRunQualityDetails(userParams, weekMeta), userParams, weekMeta, index, totalWeeks, 'key'));
    used.add(runQualityDay);
  }

  if (shouldIncludeStrength(userParams, phase)) {
    const strengthDay = findAvailableDay(3, blocked, new Set([safeLongRideDay, safeLongRunDay]), true);
    addSession(days, weekMeta.startDate, strengthDay, makeSession('strength', 'strength', 'Strength', 'Controlled general strength. Keep it smooth and avoid heavy lower-body fatigue before key bike/run sessions.', userParams, weekMeta, index, totalWeeks, 'optional'));
  }

  return { label: weekMeta.label, phase: weekMeta.phase, startDate: weekMeta.startDate, deload: weekMeta.deload, days } as WeekJson;
}

export function scaffoldSummary(scaffold: WeekJson | null): string {
  if (!scaffold) return 'No deterministic scaffold provided.';
  return JSON.stringify(scaffold.days, null, 2);
}

function sessionKey(session: unknown) {
  if (!session || typeof session !== 'object' || Array.isArray(session)) return '';
  const record = session as Record<string, unknown>;
  return `${String(record.sport ?? '').toLowerCase()} ${String(record.type ?? '').toLowerCase()} ${String(record.title ?? '').toLowerCase()} ${String(record.details ?? '').toLowerCase()}`;
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
  const type = slot.type.toLowerCase();
  const title = slot.title.toLowerCase();
  if (!key.includes(sport)) return false;
  if (key.includes(type)) return true;
  if (title.includes('long ride')) return /long ride/.test(key);
  if (title.includes('brick run')) return /brick run|transition run|off the bike/.test(key);
  if (title.includes('long run')) return /long run/.test(key);
  if (title.includes('threshold')) return /threshold|tempo|interval/.test(key);
  if (title.includes('technique')) return /technique|drill/.test(key);
  if (title.includes('endurance')) return /endurance|aerobic|steady/.test(key);
  return key.includes(title);
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

      // Keep structured scaffold details as the default. GPT may enrich weak legacy
      // sessions, but it should not replace the premium Purpose / Workout / Intensity / Coach note format.
      const details = slot.details.includes('Purpose:') ? slot.details : (generatedDetails ?? slot.details);

      return { ...slot, details: details.includes('Purpose:') ? details : withDuration(slot.durationMinutes, details) };
    });
  }

  return {
    ...generatedWeek,
    label: scaffold.label,
    phase: scaffold.phase,
    startDate: scaffold.startDate,
    deload: scaffold.deload,
    days,
    debug: [generatedWeek.debug, 'Applied dynamic triathlon plan engine scaffold. GPT enriched workout details only.']
      .filter(Boolean)
      .join('\n'),
  } as WeekJson;
}
