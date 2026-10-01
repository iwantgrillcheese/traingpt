import assert from 'node:assert/strict';
import { test } from 'node:test';
import { load } from './helpers/load-ts.mjs';

const completion = await load('utils/sessionCompletion.ts');
const pause = await load('utils/trainingPause.ts');
const { printableWeeks } = await load('utils/printablePlan.ts');
const { getWeeklySummary } = await load('utils/getWeeklySummary.ts');
const { default: merge } = await load('utils/mergeSessionWithStrava.ts');

test('early completion stays attached after move and rename; linked records never contaminate another slot', () => {
  const row = { session_id: 'a', date: '2026-10-08', session_title: 'Swim', status: 'done', completed_at: '2026-10-07T18:00:00Z' };
  assert.equal(completion.sessionIsComplete({ id: 'a', date: '2026-10-08', title: 'Swim' }, [row]), true);
  assert.equal(completion.sessionIsComplete({ id: 'a', date: '2026-10-07', title: 'Renamed swim' }, [row]), true);
  assert.equal(completion.sessionIsComplete({ id: 'b', date: row.date, title: 'Swim' }, [row]), false);
  assert.equal(row.completed_at, '2026-10-07T18:00:00Z');
});
test('undo takes precedence over retained legacy completion and historical session status', () => {
  const session = { id: 'a', date: '2026-10-08', title: 'Swim', status: 'done' };
  const rows = [{ date: session.date, session_title: session.title }, { session_id: 'a', status: 'planned' }];
  assert.equal(completion.sessionIsComplete(session, rows), false);
  assert.equal(completion.sessionIsComplete({ ...session, stravaActivity: { id: 1 } }, rows), true);
});
test('pause includes start, excludes resume, and expected return never automatically resumes', () => {
  const p = { status: 'paused', started_date: '2026-10-05', expected_return_date: '2026-10-08' };
  assert.equal(pause.dateIsPaused('2026-10-04', [p]), false);
  assert.equal(pause.dateIsPaused('2026-10-05', [p]), true);
  assert.equal(pause.dateIsPaused('2026-10-20', [p]), true);
  assert.equal(pause.trainingIsPaused([p]), true);
  const resumed = { ...p, status: 'resumed', resumed_date: '2026-10-10' };
  assert.equal(pause.dateIsPaused('2026-10-09', [resumed]), true);
  assert.equal(pause.dateIsPaused('2026-10-10', [resumed]), false);
});
test('weekly adherence combines manual and Strava completions once and excludes paused obligations', () => {
  const d = new Date(); d.setDate(d.getDate() - (d.getDay() + 6) % 7);
  const date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const sessions = [{ id: 'a', date, title: 'Swim', sport: 'swim', duration: 30 }, { id: 'b', date, title: 'Run', sport: 'run', duration: 30 }];
  const rows = [{ session_id: 'a', status: 'done', completed_at: `${date}T18:00:00Z` }];
  const activities = [{ id: 7, sport_type: 'Run', type: 'Run', start_date: `${date}T19:00:00Z`, moving_time: 1800 }];
  const summary = getWeeklySummary(sessions, rows, activities);
  assert.equal(summary.totalPlanned, 2); assert.equal(summary.totalCompleted, 2);
  const paused = getWeeklySummary(sessions, rows, activities, [{ status: 'paused', started_date: date }]);
  assert.equal(paused.totalPlanned, 0); assert.equal(paused.totalCompleted, 0);
});
test('an early manual completion reserves its actual-day Strava workout without duplication', () => {
  const sessions = [{ id: 'a', date: '2026-10-08', title: 'Swim', sport: 'swim', duration: 30 }];
  const result = merge(sessions, [{ id: 7, sport_type: 'Swim', type: 'Swim', start_date: '2026-10-07T18:00:00Z', moving_time: 1800 }], 'America/Los_Angeles', [{ session_id: 'a', status: 'done', completed_at: '2026-10-07T18:01:00Z' }]);
  assert.equal(result.merged.length, 1); assert.equal(result.merged[0].stravaActivity.id, 7);
  assert.equal(result.unmatched.length, 0);
});
test('printing groups persisted moved sessions by actual planned date rather than stale plan JSON', () => {
  const plan = { weeks: [{ startDate: '2026-10-05', phase: 'Base', days: {} }, { startDate: '2026-10-12', phase: 'Build', days: {} }] };
  const rows = [{ id: 'a', date: '2026-10-14', sport: 'swim', title: 'Long prescription ' + 'workout '.repeat(1000) }];
  const weeks = printableWeeks(plan, rows);
  assert.equal(weeks[0].sessions.length, 0); assert.equal(weeks[1].sessions[0].id, 'a');
  assert.equal(weeks[1].sessions[0].title, rows[0].title);
  const extended = printableWeeks(plan, [...rows, { ...rows[0], id: 'outside', date: '2026-11-04' }]);
  assert.equal(extended.length, 3); assert.equal(extended[2].sessions[0].id, 'outside');
});

test('five normal completions and one early completion count as six of six without missed adaptation', async () => {
  const sessions = Array.from({ length: 6 }, (_, i) => ({ id: String(i), date: `2026-10-${String(5+i).padStart(2,'0')}`, title: `Workout ${i}` }));
  const rows = sessions.map((s, i) => ({ session_id: s.id, date: s.date, session_title: s.title, status: 'done', completed_at: `${i === 5 ? '2026-10-09' : s.date}T18:00:00Z` }));
  const done = sessions.filter(s => completion.sessionIsComplete(s, rows)).length;
  assert.equal(done, 6);
  const { adaptNextWeek } = await load('utils/adaptNextWeek.ts');
  const nextWeek = { label: 'Next', startDate: '2026-10-12', phase: 'Build', days: { '2026-10-14': [{ sport: 'run', title: 'Run Easy', durationMinutes: 40 }] } };
  const result = adaptNextWeek({ nextWeek, inputs: { plannedCount: 6, completedCount: done, complianceRatio: done/6, missedAnchors: [], nextWeekIsRaceWeek: false, nextWeekDeload: false } });
  assert.equal(result.changes.length, 0);
  assert.equal(JSON.stringify(result.week), JSON.stringify(nextWeek));
});
