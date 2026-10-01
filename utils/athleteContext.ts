import { WEEKDAYS, SPORTS, CONTEXT_RACES } from '../types/athleteContext.ts';
import type { DayName, InterpretedAthleteContext, ConfirmedAthleteContext } from '../types/athleteContext.ts';
import type { UserParams } from '../types/plan';

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const day = (v: unknown): v is DayName => WEEKDAYS.includes(v as DayName);
const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim() && v.length <= 500;
export function validContextDate(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
    && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
}
/** Whitelist projection: unknown keys and malformed fields never reach the scheduler. */
export function validateAthleteContext(input: unknown): InterpretedAthleteContext {
  if (!record(input)) return {};
  const out: InterpretedAthleteContext = {};
  const days = (v: unknown) => Array.isArray(v) && v.length <= 7 && v.every(day) ? [...new Set(v)] as DayName[] : undefined;
  for (const key of ['sportAvailability', 'preferredSportDays'] as const) if (record(input[key])) {
    const availability: NonNullable<InterpretedAthleteContext['sportAvailability']> = {};
    for (const sport of SPORTS) {
      const value = days((input[key] as Record<string, unknown>)[sport]);
      if (value?.length) availability[sport] = value;
    }
    if (Object.keys(availability).length) out[key] = availability;
  }
  for (const key of ['unavailableDays', 'avoidHardTrainingDays'] as const) {
    const value = days(input[key]);
    if (value?.length) out[key] = value;
  }
  for (const key of ['restDay', 'preferredLongRunDay', 'preferredLongRideDay'] as const) if (day(input[key])) out[key] = input[key];
  if (typeof input.twoADaysAllowed === 'boolean') out.twoADaysAllowed = input.twoADaysAllowed;
  if (Array.isArray(input.recurringCommitments)) {
    const commitments: NonNullable<InterpretedAthleteContext['recurringCommitments']> = [];
    for (const item of input.recurringCommitments.slice(0, 14)) {
      if (!record(item) || !day(item.day) || !text(item.activity)) continue;
      if (item.intensity != null && !['easy', 'moderate', 'hard'].includes(String(item.intensity))) continue;
      commitments.push({ day: item.day, activity: item.activity.trim(), ...(item.intensity ? { intensity: item.intensity as 'easy' | 'moderate' | 'hard' } : {}) });
    }
    if (commitments.length) out.recurringCommitments = commitments;
  }
  if (record(input.secondaryEvent) && CONTEXT_RACES.includes(input.secondaryEvent.raceType as typeof CONTEXT_RACES[number])) {
    out.secondaryEvent = { raceType: input.secondaryEvent.raceType as typeof CONTEXT_RACES[number], raceDate: validContextDate(input.secondaryEvent.raceDate) ? input.secondaryEvent.raceDate : null };
  }
  if (Array.isArray(input.preferences)) {
    const preferences: NonNullable<InterpretedAthleteContext['preferences']> = [];
    for (const p of input.preferences.slice(0, 20)) if (record(p) && text(p.text) && (p.strength === 'context' || p.strength === 'preference')) preferences.push({ text: p.text.trim(), strength: p.strength });
    if (preferences.length) out.preferences = preferences;
  }
  if (Array.isArray(input.unsupportedRequests)) {
    const requests = input.unsupportedRequests.filter(text).slice(0, 20);
    if (requests.length) out.unsupportedRequests = requests;
  }
  return out;
}

export function validateConfirmedContext(input: unknown, notes: string): ConfirmedAthleteContext | undefined {
  if (input == null) return undefined; // Legacy plans remain valid.
  if (!record(input) || input.version !== 1 || input.sourceNotes !== notes || typeof input.confirmedAt !== 'string'
    || !Number.isFinite(Date.parse(input.confirmedAt)) || !record(input.context)) throw new Error('Review and confirm the interpretation of your current comments before generating.');
  const context = validateAthleteContext(input.context);
  // Confirmed input must not be silently weakened by field omission.
  const canonical = (value: unknown): string => {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (record(value)) return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
    return JSON.stringify(value);
  };
  if (canonical(context) !== canonical(input.context)) throw new Error('Some confirmed rules are invalid. Please review them.');
  return { version: 1, sourceNotes: notes, confirmedAt: input.confirmedAt, context };
}

export function resolveAthleteContext(params: UserParams): UserParams {
  const c = params.athleteContext?.context;
  if (!c) return params;
  return { ...params, restDay: c.restDay ?? params.restDay,
    sportAvailability: { ...params.sportAvailability, ...c.sportAvailability },
    unavailableDays: [...new Set([...(params.unavailableDays ?? []), ...(c.unavailableDays ?? [])])],
    preferredLongRunDay: c.preferredLongRunDay ?? params.preferredLongRunDay,
    preferredLongRideDay: c.preferredLongRideDay ?? params.preferredLongRideDay,
    trainingPrefs: { ...params.trainingPrefs, ...(c.preferredLongRunDay ? { longRunDay: WEEKDAYS.indexOf(c.preferredLongRunDay) } : {}), ...(c.preferredLongRideDay ? { longRideDay: WEEKDAYS.indexOf(c.preferredLongRideDay) } : {}) },
    twoADaysAllowed: c.twoADaysAllowed ?? params.twoADaysAllowed };
}

export function hasSchedulingContext(params: UserParams): boolean {
  const c = params.athleteContext?.context;
  if (!c) return false;
  const running = params.planType === 'running' || params.planType === 'run';
  return !!(c.unavailableDays?.length || c.restDay || c.preferredLongRunDay || c.avoidHardTrainingDays?.length
    || c.recurringCommitments?.length || c.twoADaysAllowed !== undefined
    || c.preferredSportDays?.run?.length || (!running && Object.keys(c.preferredSportDays ?? {}).length > 0)
    || c.sportAvailability?.run?.length || (!running && (c.preferredLongRideDay
      || c.sportAvailability?.swim?.length || c.sportAvailability?.bike?.length || c.sportAvailability?.strength?.length)));
}

export function contextSummary(c: InterpretedAthleteContext): string[] {
  const lines: string[] = [];
  for (const sport of SPORTS) if (c.sportAvailability?.[sport]) lines.push(`${sport[0].toUpperCase() + sport.slice(1)} only ${c.sportAvailability[sport]!.join(' & ')}`);
  for (const sport of SPORTS) if (c.preferredSportDays?.[sport]) lines.push(`Prefer ${sport} on ${c.preferredSportDays[sport]!.join(' & ')} (other days allowed)`);
  if (c.unavailableDays?.length) lines.push(`No training ${c.unavailableDays.join(' & ')}`);
  if (c.restDay) lines.push(`Rest day ${c.restDay}`);
  for (const r of c.recurringCommitments ?? []) {
    lines.push(`${r.activity} every ${r.day}${r.intensity ? ` (${r.intensity})` : ''}`);
    if (r.intensity === 'hard' || (r.intensity !== 'easy' && /soccer|football|basketball|hockey|rugby|tennis/i.test(r.activity))) lines.push(`Avoid hard lower-body work around ${r.activity} where possible`);
  }
  if (c.avoidHardTrainingDays?.length) lines.push(`Avoid hard training ${c.avoidHardTrainingDays.join(' & ')}`);
  if (c.preferredLongRunDay) lines.push(`Long run ${c.preferredLongRunDay}`);
  if (c.preferredLongRideDay) lines.push(`Long ride ${c.preferredLongRideDay}`);
  if (c.twoADaysAllowed !== undefined) lines.push(c.twoADaysAllowed ? 'Two-a-days allowed' : 'Prefer one session per day');
  if (c.secondaryEvent) lines.push(`Secondary goal: ${c.secondaryEvent.raceType}${c.secondaryEvent.raceDate ? ` on ${c.secondaryEvent.raceDate}` : ' — date needed'}. Confirm its date and priority in the event settings to include it in your integrated plan.`);
  lines.push(...(c.preferences ?? []).map(p => p.text), ...(c.unsupportedRequests ?? []).map(p => `Context only: ${p}`));
  return lines;
}
export function contextAnalytics(c: InterpretedAthleteContext) {
  return { rule_types: Object.keys(c), extracted_rule_count: contextSummary(c).length };
}
