import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateCase, sessions, total } from './diagnose-triathlon-duration.ts';
import { usefulMinimum, allocateTriathlonWeek } from '../utils/triathlonWeekBudget.ts';
import { integrateSecondaryEvent } from '../utils/secondaryEvent.ts';

for (const hours of [8, 10]) for (const secondary of [false, true]) {
  test(`${hours}h ${secondary ? 'Marathon secondary' : 'single goal'}: Build/Peak recover after deload without collapsing`, () => {
    const c = generateCase(hours, secondary);
    let previousVolume = 0;
    let previousRide = 0;
    let previousRun = 0;
    for (let i = 0; i < 14; i++) {
      const week = c.final[i];
      assert.ok(total(c.raw[i]) <= hours * 60, 'Scaffold must fit before post-processing');
      assert.ok(total(c.integrated[i]) <= hours * 60, 'Secondary cannot oversize week');
      assert.equal(total(week), total(c.scheduled[i]), 'Safety rail must not routinely compress supported plans');
      if (week.deload) continue;
      const items = sessions(week);
      const ride = items.find(s => s.type === 'long_ride')!.durationMinutes!;
      const run = items.find(s => s.type === 'long_run')!.durationMinutes!;
      assert.ok(total(week) >= previousVolume * 0.95, `${week.label}: normal volume collapsed`);
      assert.ok(ride >= previousRide, `${week.label}: ride progression collapsed`);
      assert.ok(run >= previousRun, `${week.label}: run progression collapsed`);
      assert.ok(items.every(s => s.durationMinutes! >= usefulMinimum({ ...s, durationMinutes: 1000 })), 'Useful durations preserved');
      assert.equal(items.length, sessions(c.raw[i]).length, 'Secondary must rebalance existing slots');
      assert.equal(total(c.integrated[i]), total(c.raw[i]), 'Run emphasis transfers minutes without adding load');
      previousVolume = total(week); previousRide = ride; previousRun = run;
    }
    assert.ok(previousRide >= 165 && previousRun >= 90, 'Race-appropriate peak anchors');
    assert.equal(c.adjustedWeeks, 0);
  });
}

test('Sport-specific days change placement without collapsing progression', () => {
  const c = generateCase(8, true, { twoADaysAllowed: true, sportAvailability: {
    swim: ['Tuesday', 'Friday'], bike: ['Thursday', 'Saturday'], run: ['Wednesday', 'Saturday', 'Sunday'],
  } });
  for (let i = 0; i < 14; i++) {
    assert.equal(total(c.integrated[i]), total(c.final[i]));
    for (const [date, items] of Object.entries(c.final[i].days)) for (const item of items) {
      if (typeof item === 'string' || !['bike', 'run', 'swim'].includes(item.sport!)) continue;
      const day = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
      assert.ok(c.params.sportAvailability![item.sport as 'bike' | 'run' | 'swim']!.includes(day as never));
    }
  }
});

test('Secondary taper/recovery is temporary and real post-event rebuilding is documented', () => {
  const c = generateCase(10, true);
  for (const i of [16, 17]) assert.equal(c.final[i].phase, 'Recovery');
  assert.ok(total(c.final[18]) > total(c.final[17]) * 2);
  assert.match(c.final[18].debug!, /Deliberate post-event rebuilding/);
  assert.equal(c.final[21].phase, 'Taper');
  const early = generateCase(10, true, { secondaryEvent: { raceType: 'Marathon', raceDate: '2026-11-29' } });
  assert.equal(early.final[7].phase, 'Taper');
  assert.equal(early.final[8].phase, 'Recovery');
  assert.ok(total(early.final[12]) > 450, 'Rebuild must resume rather than compound recovery reductions');
});

test('Secondary integration is pure and does not mutate scaffold input', () => {
  const c = generateCase(10, true);
  const original = JSON.stringify(c.raw);
  integrateSecondaryEvent(c.raw, c.params);
  assert.equal(JSON.stringify(c.raw), original);
});

test('Oversized week removes unusable support slots while protecting anchors', () => {
  const c = generateCase(10, false);
  const week = c.raw[13];
  const allocated = allocateTriathlonWeek(week, 400);
  assert.ok(total(allocated) <= 400);
  assert.equal(sessions(allocated).find(s => s.type === 'long_ride')!.durationMinutes, 180);
  assert.equal(sessions(allocated).find(s => s.type === 'long_run')!.durationMinutes, 95);
  assert.throws(() => allocateTriathlonWeek(week, 60), /useful anchor/);
});
