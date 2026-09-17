import { addDays, addWeeks, formatISO } from 'date-fns';
import { buildTriathlonWeekScaffold } from '../utils/buildTriathlonScaffold.ts';
import { enforceTriathlonScheduleConstraints } from '../utils/enforceTriathlonScheduleConstraints.ts';
import { enforceTriathlonTimeBudget } from '../utils/enforceTriathlonTimeBudget.ts';
import { validateGeneratedPlan } from '../utils/validateGeneratedPlan.ts';
import type { GeneratedPlan, UserParams, WeekJson, WeekMeta } from '../types/plan.ts';

const START = new Date('2026-09-21T12:00:00Z');

function iso(d: Date) { return formatISO(d, { representation: 'date' }); }

function meta(totalWeeks: number): WeekMeta[] {
  const peakWeeks = Math.min(2, Math.max(0, totalWeeks >= 10 ? 2 : totalWeeks >= 8 ? 1 : 0));
  const taperWeeks = Math.min(2, Math.max(1, totalWeeks >= 10 ? 2 : 1));
  const remaining = Math.max(0, totalWeeks - peakWeeks - taperWeeks);
  const baseWeeks = Math.max(1, Math.round(remaining * 0.5));
  const buildWeeks = Math.max(0, remaining - baseWeeks);
  const phases = [...Array(baseWeeks).fill('Base'), ...Array(buildWeeks).fill('Build'), ...Array(peakWeeks).fill('Peak'), ...Array(taperWeeks).fill('Taper')];
  return Array.from({ length: totalWeeks }, (_, i) => ({
    label: `Week ${i + 1}`,
    phase: phases[i] ?? 'Base',
    startDate: iso(addWeeks(START, i)),
    deload: i > 0 && (i + 1) % 4 === 0 && ['Base', 'Build'].includes(phases[i]),
  }));
}

function duration(item: unknown): number {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return 0;
  const value = Number((item as Record<string, unknown>).durationMinutes);
  return Number.isFinite(value) ? value : 0;
}

function text(item: unknown) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return '';
  const r = item as Record<string, unknown>;
  return `${r.title ?? ''} ${r.details ?? ''} ${r.intensity ?? ''}`;
}

const cases: Array<{ name: string; weeks: number; params: Omit<UserParams, 'raceDate'> }> = [
  { name: 'beginner sprint 6h', weeks: 16, params: { raceType: 'Sprint', experience: 'Beginner', maxHours: 6, restDay: 'Monday', preferredLongRideDay: 'Saturday', preferredLongRunDay: 'Sunday', swimComfort: 'developing', twoADaysAllowed: false, bikeFTP: 180, bikeFtp: 180, runPace: '8:00 / mi', swimPace: '2:00 / 100m', paceUnit: 'mi' } },
  { name: 'intermediate olympic 8h', weeks: 14, params: { raceType: 'Olympic', experience: 'Intermediate', maxHours: 8, restDay: 'Monday', preferredLongRideDay: 'Saturday', preferredLongRunDay: 'Sunday', swimComfort: 'comfortable', twoADaysAllowed: false, bikeFTP: 235, bikeFtp: 235, runPace: '7:10 / mi', swimPace: '1:42 / 100m', paceUnit: 'mi' } },
  { name: 'intermediate 70.3 8h', weeks: 20, params: { raceType: 'Half Ironman (70.3)', experience: 'Intermediate', maxHours: 8, restDay: 'Monday', preferredLongRideDay: 'Saturday', preferredLongRunDay: 'Sunday', swimComfort: 'comfortable', twoADaysAllowed: false, bikeFTP: 255, bikeFtp: 255, runPace: '6:55 / mi', swimPace: '1:38 / 100m', paceUnit: 'mi' } },
  { name: 'advanced 70.3 12h short build', weeks: 12, params: { raceType: 'Half Ironman (70.3)', experience: 'Advanced', maxHours: 12, restDay: 'Monday', preferredLongRideDay: 'Saturday', preferredLongRunDay: 'Sunday', swimComfort: 'strong', twoADaysAllowed: true, bikeFTP: 310, bikeFtp: 310, runPace: '6:10 / mi', swimPace: '1:28 / 100m', paceUnit: 'mi' } },
  { name: 'beginner ironman constrained', weeks: 24, params: { raceType: 'Ironman (140.6)', experience: 'Beginner', maxHours: 7, restDay: 'Monday', preferredLongRideDay: 'Saturday', preferredLongRunDay: 'Sunday', swimComfort: 'developing', twoADaysAllowed: false, bikeFTP: 190, bikeFtp: 190, runPace: '8:30 / mi', swimPace: '2:05 / 100m', paceUnit: 'mi' } },
  { name: 'advanced ironman high volume', weeks: 24, params: { raceType: 'Ironman (140.6)', experience: 'Advanced', maxHours: 16, restDay: 'Monday', preferredLongRideDay: 'Saturday', preferredLongRunDay: 'Sunday', swimComfort: 'strong', twoADaysAllowed: true, bikeFTP: 330, bikeFtp: 330, runPace: '6:20 / mi', swimPace: '1:25 / 100m', paceUnit: 'mi' } },
  { name: '70.3 six weeks', weeks: 6, params: { raceType: 'Half Ironman (70.3)', experience: 'Intermediate', maxHours: 9, restDay: 'Monday', preferredLongRideDay: 'Saturday', preferredLongRunDay: 'Sunday', swimComfort: 'comfortable', twoADaysAllowed: false, bikeFTP: 250, bikeFtp: 250, runPace: '7:00 / mi', swimPace: '1:40 / 100m', paceUnit: 'mi' } },
  { name: 'olympic two weeks taper', weeks: 2, params: { raceType: 'Olympic', experience: 'Intermediate', maxHours: 7, restDay: 'Monday', preferredLongRideDay: 'Saturday', preferredLongRunDay: 'Sunday', swimComfort: 'comfortable', twoADaysAllowed: false, bikeFTP: 240, bikeFtp: 240, runPace: '7:05 / mi', swimPace: '1:43 / 100m', paceUnit: 'mi' } },
  { name: 'weak swimmer', weeks: 16, params: { raceType: 'Half Ironman (70.3)', experience: 'Intermediate', maxHours: 9, restDay: 'Monday', preferredLongRideDay: 'Saturday', preferredLongRunDay: 'Sunday', swimComfort: 'new', twoADaysAllowed: false, bikeFTP: 250, bikeFtp: 250, runPace: '7:00 / mi', paceUnit: 'mi' } },
  { name: 'nonstandard weekend blocked', weeks: 16, params: { raceType: 'Half Ironman (70.3)', experience: 'Intermediate', maxHours: 9, restDay: 'Friday', preferredLongRideDay: 'Thursday', preferredLongRunDay: 'Tuesday', unavailableDays: ['Saturday', 'Sunday'], swimComfort: 'comfortable', twoADaysAllowed: false, bikeFTP: 250, bikeFtp: 250, runPace: '7:00 / mi', swimPace: '1:40 / 100m', paceUnit: 'mi' } },
  { name: 'two a days disabled', weeks: 16, params: { raceType: 'Olympic', experience: 'Intermediate', maxHours: 7, restDay: 'Monday', preferredLongRideDay: 'Saturday', preferredLongRunDay: 'Sunday', swimComfort: 'comfortable', twoADaysAllowed: false, bikeFTP: 230, bikeFtp: 230, runPace: '7:20 / mi', swimPace: '1:45 / 100m', paceUnit: 'mi' } },
  { name: 'no precision metrics', weeks: 16, params: { raceType: 'Half Ironman (70.3)', experience: 'Beginner', maxHours: 7, restDay: 'Monday', preferredLongRideDay: 'Saturday', preferredLongRunDay: 'Sunday', swimComfort: 'developing', twoADaysAllowed: false, paceUnit: 'mi' } },
];

const results = cases.map((c) => {
  const weeksMeta = meta(c.weeks);
  const raceDate = iso(addDays(addWeeks(START, c.weeks - 1), 6));
  const params: UserParams = { ...c.params, raceDate };
  const ftp = params.bikeFTP;
  const raw = weeksMeta
    .map((m, i) => buildTriathlonWeekScaffold({ userParams: params, weekMeta: m, index: i, totalWeeks: c.weeks }))
    .filter((w): w is WeekJson => !!w);
  const scheduled = enforceTriathlonScheduleConstraints({
    weeks: raw,
    raceDate,
    restDay: params.restDay,
    unavailableDays: params.unavailableDays,
    preferredLongRideDay: params.preferredLongRideDay,
    preferredLongRunDay: params.preferredLongRunDay,
    twoADaysAllowed: params.twoADaysAllowed ?? false,
  });
  const budgeted = enforceTriathlonTimeBudget({ weeks: scheduled.weeks, maxHours: params.maxHours, raceDate });
  const plan: GeneratedPlan = { planType: 'triathlon', params, weeks: budgeted.weeks };
  const validation = validateGeneratedPlan({ plan, expectedWeeks: c.weeks, userParams: params });
  const budgetViolations: string[] = [];
  const blockedViolations: string[] = [];
  let ftpTargetMissing = false;

  for (const week of budgeted.weeks) {
    const raceWeek = Object.prototype.hasOwnProperty.call(week.days, raceDate);
    const allItems = Object.values(week.days).flatMap(v => Array.isArray(v) ? v : []);
    const total = allItems.reduce((sum, item) => sum + duration(item), 0);
    if (!raceWeek && total > params.maxHours * 60 + 1) budgetViolations.push(`${week.label}:${total}`);
    for (const [date, items] of Object.entries(week.days)) {
      const d = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
      if (date !== raceDate && (d === params.restDay || (params.unavailableDays ?? []).includes(d)) && Array.isArray(items) && items.length) blockedViolations.push(`${week.label}:${d}`);
    }
    if (ftp != null && allItems.some(item => /bike|ride/i.test(text(item))) && !allItems.some(item => text(item).includes(`${Math.round(ftp * .65)}`) || text(item).includes('% FTP'))) ftpTargetMissing = true;
  }

  const pass = validation.ok && budgetViolations.length === 0 && blockedViolations.length === 0 && !ftpTargetMissing;
  return {
    name: c.name,
    pass,
    validationScore: validation.score,
    errors: validation.errors,
    warnings: validation.warnings,
    budgetViolations,
    blockedViolations,
    ftpTargetMissing,
    adjustedWeeks: budgeted.adjustedWeeks,
    movedSessions: scheduled.movedSessions,
    droppedSessions: scheduled.droppedSessions,
  };
});

for (const result of results) {
  console.log(`${result.pass ? 'PASS' : 'FAIL'} ${result.name} score=${result.validationScore} adjusted=${result.adjustedWeeks} moved=${result.movedSessions} dropped=${result.droppedSessions}`);
  if (!result.pass) console.log(JSON.stringify(result, null, 2));
}

const failed = results.filter(result => !result.pass);
if (failed.length) {
  console.error(`Plan quality matrix failed: ${failed.length}/${results.length} cases.`);
  process.exit(1);
}

console.log(`Plan quality matrix passed: ${results.length}/${results.length} cases.`);
