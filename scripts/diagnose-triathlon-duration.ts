import { writeFileSync } from 'node:fs';
import { addDays, formatISO } from 'date-fns';
import { buildTriathlonWeekScaffold } from '../utils/buildTriathlonScaffold.ts';
import { integrateSecondaryEvent } from '../utils/secondaryEvent.ts';
import { enforceTriathlonScheduleConstraints } from '../utils/enforceTriathlonScheduleConstraints.ts';
import { enforceTriathlonTimeBudget } from '../utils/enforceTriathlonTimeBudget.ts';
import type { UserParams, WeekJson } from '../types/plan.ts';

const iso = (date: Date) => formatISO(date, { representation: 'date' });
const start = new Date('2026-10-05T12:00:00');
const raceDate = iso(addDays(start, 111));
export const sessions = (week: WeekJson) => Object.values(week.days).flat().filter((s): s is Exclude<typeof s, string> => typeof s === 'object');
export const total = (week: WeekJson) => sessions(week).reduce((n, s) => n + Number(s.durationMinutes ?? 0), 0);
export function generateCase(maxHours: number, secondary: boolean, extra: Partial<UserParams> = {}) {
  const params: UserParams = { raceType: 'Half Ironman (70.3)', raceDate, experience: 'Intermediate', maxHours, restDay: 'Monday', preferredLongRideDay: 'Saturday', preferredLongRunDay: 'Sunday', twoADaysAllowed: false, ...(secondary ? { secondaryEvent: { raceType: 'Marathon', raceDate: iso(addDays(start, 167)) } } : {}), ...extra };
  const raw = Array.from({ length: secondary ? 24 : 16 }, (_, index) => {
    const phase = index < 6 ? 'Base' : index < 12 ? 'Build' : index < 14 ? 'Peak' : index < 16 ? 'Taper' : index < 18 ? 'Recovery' : 'Build';
    return buildTriathlonWeekScaffold({ userParams: params, index, totalWeeks: 16, weekMeta: { label: `Week ${index + 1}`, phase, deload: phase === 'Recovery' || index > 0 && (index + 1) % 4 === 0 && ['Base', 'Build'].includes(phase), startDate: iso(addDays(start, index * 7)) } })!;
  });
  const integrated = integrateSecondaryEvent(raw, params);
  const scheduled = enforceTriathlonScheduleConstraints({ weeks: integrated, ...params, secondaryRaceDate: params.secondaryEvent?.raceDate });
  const budgeted = enforceTriathlonTimeBudget({ weeks: scheduled.weeks, maxHours, raceDate });
  return { params, raw, integrated, scheduled: scheduled.weeks, final: budgeted.weeks, adjustedWeeks: budgeted.adjustedWeeks };
}
export function diagnosticReport() {
  let report = '# Triathlon duration diagnostic\n\nSource: recovered features integrated with current main (039a3e8), review branch codex/recover-customer-feedback. Primary 70.3 at week 16; secondary Marathon eight weeks later. Secondary cases include the extended horizon. All totals include race minutes where supplied.\n\n';
  for (const [name, hours, secondary] of [['A', 10, false], ['B', 10, true], ['C', 8, false], ['D', 8, true]] as const) {
    const c = generateCase(hours, secondary);
    report += `## Case ${name}: ${hours}h, ${secondary ? 'secondary Marathon' : 'single goal'}\n\n|Week|Phase|Deload|Scaffold|Before guards (after secondary)|After schedule|After budget|Sessions|Long Ride|Long Run|Max Bike|Max Run|Budget modified|Session minutes|\n|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|\n`;
    c.raw.forEach((week, i) => {
      const items = sessions(c.final[i]);
      const anchor = (type: string) => items.find(s => s.type === type)?.durationMinutes ?? '—';
      const longest = (sport: string) => Math.max(0, ...items.filter(s => s.sport === sport).map(s => Number(s.durationMinutes ?? 0)));
      report += `|${i + 1}|${c.integrated[i].phase}|${c.integrated[i].deload}|${total(week)}|${total(c.integrated[i])}|${total(c.scheduled[i])}|${total(c.final[i])}|${items.length}|${anchor('long_ride')}|${anchor('long_run')}|${longest('bike')}|${longest('run')}|${total(c.final[i]) !== total(c.scheduled[i])}|${items.map(s => `${s.title}: ${s.durationMinutes}`).join('; ')}|\n`;
    });
    report += '\n';
  }
  return report;
}
if (process.argv[1]?.endsWith('diagnose-triathlon-duration.ts')) {
  const report = diagnosticReport();
  if (process.argv[2]) writeFileSync(process.argv[2], report);
  console.log(report);
}
