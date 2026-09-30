import { WEEKDAYS } from '../types/athleteContext.ts';
import type { ContextSport } from '../types/athleteContext.ts';
import type { UserParams, WeekJson } from '../types/plan';
import { resolveAthleteContext, hasSchedulingContext } from './athleteContext.ts';

export class AthleteContextConflict extends Error {
  code = 'ATHLETE_CONTEXT_CONFLICT';
}
const dow = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
const dayName = (value: unknown) => typeof value === 'number' ? WEEKDAYS[value] : String(value);
type Item = Exclude<WeekJson['days'][string][number], string>;
const isHard = (s: Item) => /quality|threshold|tempo|interval/i.test(`${s.type ?? ''} ${s.title ?? ''}`);
const lowerBody = (s: Item) => ['run', 'bike', 'strength'].includes(s.sport ?? '');

export function commitmentPenalty(params: UserParams, day: number): number {
  let penalty = 0;
  for (const r of params.athleteContext?.context.recurringCommitments ?? []) {
    const demanding = r.intensity === 'hard' || (r.intensity !== 'easy' && /soccer|football|basketball|hockey|rugby|tennis/i.test(r.activity));
    if (!demanding) continue;
    const delta = (day - WEEKDAYS.indexOf(r.day) + 7) % 7;
    if (delta === 0 || delta === 1) penalty += 1000;
    else if (delta === 6) penalty += 700;
  }
  return penalty;
}

export function assertContextFeasible(input: UserParams) {
  if (!input.athleteContext) return;
  const params = resolveAthleteContext(input);
  const blocked = new Set([params.restDay, ...(params.unavailableDays ?? [])].filter(v => v != null).map(dayName));
  const c = params.athleteContext!.context;
  const sports: ContextSport[] = params.planType === 'running' ? ['run'] : ['swim', 'bike', 'run'];
  for (const sport of sports) {
    const allowed = c.sportAvailability?.[sport] ?? [...WEEKDAYS];
    if (!allowed.some(d => !blocked.has(d))) throw new AthleteContextConflict(
      `No available ${sport} day: ${allowed.join(' & ')} ${allowed.length === 1 ? 'is' : 'are'} blocked by your rest day (${params.restDay ?? 'none'}) or unavailable days. Edit your schedule or availability.`);
  }
}

/** Preserve every slot and duration; find dates under hard rules before considering preferences.
 * Invoked by scaffold, final guards and enrichment. No context returns the original week.
 */
export function scheduleAthleteContext(week: WeekJson, input: UserParams): WeekJson {
  if (!hasSchedulingContext(input)) return week;
  const params = resolveAthleteContext(input);
  assertContextFeasible(params);
  const c = params.athleteContext!.context;
  const blocked = new Set([params.restDay, ...(params.unavailableDays ?? [])].filter(v => v != null).map(dayName));
  const dates = Object.keys(week.days).sort();
  const raceWeek = dates.includes(params.raceDate);
  const output: Record<string, Item[]> = Object.fromEntries(dates.map(date => [date, []]));
  const groups: Array<{ original: string; items: Item[]; candidates: string[] }> = [];
  for (const [original, sessions] of Object.entries(week.days)) {
    const items = sessions.filter((s): s is Item => typeof s !== 'string');
    if (items.length !== sessions.length) throw new AthleteContextConflict('Cannot verify availability for an unstructured session. Please regenerate the plan.');
    const brick = items.find(s => s.type === 'brick_run');
    const ride = brick && items.find(s => s.type === 'long_ride');
    const bundles = items.filter(s => s !== brick && s !== ride).map(s => [s]);
    if (brick && ride) bundles.push([ride, brick]);
    else if (brick) bundles.push([brick]);
    for (const bundle of bundles) {
      if (bundle.some(s => s.type === 'race_day')) { output[original].push(...bundle); continue; }
      const candidates = dates.filter(date => {
        const name = WEEKDAYS[dow(date)];
        return !blocked.has(name) && (!raceWeek || date < params.raceDate)
          && bundle.every(s => {
            const allowed = c.sportAvailability?.[s.sport as ContextSport];
            return (!allowed || allowed.includes(name)) && (!isHard(s) || !c.avoidHardTrainingDays?.includes(name));
          });
      });
      if (!candidates.length) throw new AthleteContextConflict(`No valid day for ${bundle[0].title ?? bundle[0].sport} in ${week.label}. Availability, rest/unavailable days and avoid-hard rules conflict. Please edit them.`);
      groups.push({ original, items: bundle, candidates });
    }
  }
  for (const sport of ['swim', 'bike', 'run', 'strength'] as const) {
    const sportGroups = groups.filter(g => g.items.some(s => s.sport === sport));
    const available = [...new Set(sportGroups.flatMap(g => g.candidates))];
    if (sportGroups.length > available.length) throw new AthleteContextConflict(
      `${week.label} needs ${sportGroups.length} ${sport} sessions on separate days, but your confirmed rules leave ${available.length} ${sport} day${available.length === 1 ? '' : 's'} (${available.map(d => WEEKDAYS[dow(d)]).join(' & ') || 'none'}). Review ${sport} availability and your rest/unavailable days.`);
  }
  // Most restricted slots first, then anchors. Search retains all slots, including two swims.
  groups.sort((a, b) => a.candidates.length - b.candidates.length || Number(b.items.some(s => s.priority === 'anchor')) - Number(a.items.some(s => s.priority === 'anchor')));
  let bestScore = Infinity;
  let best: Record<string, Item[]> | undefined;
  let visits = 0;
  const scoreFor = (group: typeof groups[number], date: string) => {
    const name = WEEKDAYS[dow(date)];
    const hard = group.items.some(s => isHard(s) || s.type === 'long_run' || s.type === 'long_ride');
    let score = hard && group.items.some(lowerBody) ? commitmentPenalty(params, dow(date)) : 0;
    const preference = group.items.some(s => s.type === 'long_run') ? params.preferredLongRunDay ?? params.trainingPrefs?.longRunDay
      : group.items.some(s => s.type === 'long_ride') ? params.preferredLongRideDay ?? params.trainingPrefs?.longRideDay : undefined;
    for (const item of group.items) {
      const preferred = c.preferredSportDays?.[item.sport as ContextSport];
      if (preferred?.length && !preferred.includes(name)) score += 10;
    }
    if (preference != null && dayName(preference) !== name) score += 50;
    if (hard && group.items.some(lowerBody)) {
      for (const [placedDate, placed] of Object.entries(output)) {
        const delta = (dow(placedDate) - dow(date) + 7) % 7;
        if ((delta === 0 || delta === 1 || delta === 6) && placed.some(s => lowerBody(s) && (isHard(s) || s.type === 'long_run' || s.type === 'long_ride'))) score += 20;
      }
    }
    // Permission for doubles is not a preference to leave usable days empty.
    // The ride + brick remains one inseparable group and incurs no internal pairing cost.
    if (output[date].length) score += params.twoADaysAllowed ? 5 : 15;
    if (date !== group.original) score += 1;
    return score;
  };
  const search = (index: number, score: number) => {
    if (++visits > 200000 || score >= bestScore) return;
    if (index === groups.length) { bestScore = score; best = Object.fromEntries(dates.map(d => [d, [...output[d]]])); return; }
    const group = groups[index];
    const candidates = group.candidates.map(date => ({ date, score: scoreFor(group, date) })).sort((a, b) => a.score - b.score || a.date.localeCompare(b.date));
    for (const candidate of candidates) {
      const existing = output[candidate.date];
      // Two-a-day is a preference; pairing is permitted when needed, capped at two slots.
      if (existing.length + group.items.length > 2 || group.items.some(s => existing.some(e => e.sport === s.sport))) continue;
      output[candidate.date] = [...existing, ...group.items];
      search(index + 1, score + candidate.score);
      output[candidate.date] = existing;
    }
  };
  search(0, 0);
  if (!best) throw new AthleteContextConflict(`We could not fit every session in ${week.label} within your confirmed availability. Please add availability or revise the conflicting rules.`);
  return { ...week, days: best };
}

/** Final verification also covers any later repair or adaptation. */
export function assertAthleteContextHonored(weeks: WeekJson[], input: UserParams) {
  if (!input.athleteContext) return;
  const params = resolveAthleteContext(input);
  const c = params.athleteContext!.context;
  const blocked = new Set([params.restDay, ...(params.unavailableDays ?? [])].map(dayName));
  for (const week of weeks) for (const [date, sessions] of Object.entries(week.days)) for (const s of sessions) {
    if (typeof s === 'string') throw new AthleteContextConflict('Unstructured session could not be checked against your rules.');
    if (s.type === 'race_day') continue; // Athlete's chosen event is not prescribed training.
    const name = WEEKDAYS[dow(date)];
    const allowed = c.sportAvailability?.[s.sport as ContextSport];
    if (blocked.has(name) || (allowed && !allowed.includes(name)) || (isHard(s) && c.avoidHardTrainingDays?.includes(name))) throw new AthleteContextConflict(`A session in ${week.label} conflicts with your confirmed rules. Please revise your availability.`);
  }
}
