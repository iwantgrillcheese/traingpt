import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addDays, addWeeks, formatISO, startOfWeek } from 'date-fns';

import { load } from './helpers/load-ts.mjs';

const iso = date => formatISO(date, { representation: 'date' });
const start = startOfWeek(new Date(), { weekStartsOn: 1 });
const builder = await load('utils/buildRunningScaffold.ts');
const validator = await load('utils/validateGeneratedPlan.ts');
const targets = await load('utils/runTargets.ts');
const triathlon = await load('utils/buildTriathlonScaffold.ts');
const constraints = await load('utils/enforceTriathlonScheduleConstraints.ts');
const completion = await load('utils/sessionCompletion.ts');
const adaptation = await load('utils/adaptNextWeek.ts');
const weeklySummary = await load('utils/getWeeklySummary.ts');
const pauseHelpers = await load('utils/trainingPause.ts');
const secondary = await load('utils/secondaryEvent.ts');
const printable = await load('utils/printablePlan.ts');

test('print grouping follows persisted repositioned session dates and retains details', () => {
  const plan = { weeks: [{ startDate: '2027-01-04', phase: 'Build' }, { startDate: '2027-01-11', phase: 'Taper' }] };
  const session = { id: 's1', date: '2027-01-12', sport: 'Run', title: 'Moved Run', duration: 45, details: 'Easy conversational running' };
  const weeks = printable.printableWeeks(plan, [session]);
  assert.equal(weeks[0].sessions.length, 0);
  assert.equal(weeks[1].sessions[0].details, session.details);
  assert.equal(weeks[1].number, 2);
  assert.equal(weeks[1].phase, 'Taper');
});

test('two event plan reallocates existing volume, retains swim/bike, tapers and recovers', () => {
  const params = { raceType: 'Half Ironman (70.3)', raceDate: '2027-06-20', maxHours: 10, restDay: 'Monday', twoADaysAllowed: true,
    secondaryEvent: { raceType: 'Marathon', raceDate: '2027-03-21' } };
  const weeks = Array.from({ length: 16 }, (_, i) => triathlon.buildTriathlonWeekScaffold({ userParams: params, index: i, totalWeeks: 24,
    weekMeta: { label: `Week ${i+1}`, startDate: iso(addWeeks(new Date('2027-01-04T12:00:00'), i)), phase: 'Build', deload: false } }));
  const integrated = secondary.integrateSecondaryEvent(weeks, params);
  const final = constraints.enforceTriathlonScheduleConstraints({ weeks: integrated, ...params, secondaryRaceDate: params.secondaryEvent.raceDate }).weeks;
  const minutes = week => Object.values(week.days).flat().reduce((sum, s) => sum + (s.type === 'race_day' ? 0 : s.durationMinutes ?? 0), 0);
  for (let i=0;i<final.length;i++) {
    assert.ok(minutes(final[i]) <= params.maxHours*60);
    assert.ok(minutes(integrated[i]) <= minutes(weeks[i]));
    if (!/Taper|Recovery/.test(final[i].phase)) {
      assert.ok(Object.values(final[i].days).flat().some(s => s.sport === 'swim'));
      assert.ok(Object.values(final[i].days).flat().some(s => s.sport === 'bike'));
    }
  }
  const eventWeek = final.find(w => w.days[params.secondaryEvent.raceDate]);
  assert.equal(eventWeek.days[params.secondaryEvent.raceDate][0].type, 'race_day');
  assert.match(eventWeek.days[params.secondaryEvent.raceDate][0].title, /Secondary/);
  assert.equal(final.find(w => w.startDate === '2027-03-22').phase, 'Recovery');
  assert.equal(final.find(w => w.startDate === '2027-03-08').phase, 'Taper');
});

test('secondary conflicts and explicit priority are validated; single-goal plan is untouched', () => {
  const primary = { raceType: 'Half Ironman (70.3)', raceDate: '2027-06-20', maxHours: 10 };
  assert.throws(() => secondary.normalizeSecondaryEvent({ raceType: 'Marathon', raceDate: '2027-06-13' }, primary), /too close/);
  assert.throws(() => secondary.normalizeSecondaryEvent({ raceType: 'Marathon', raceDate: '2027-05-23' }, primary), /Confirm/);
  assert.ok(secondary.normalizeSecondaryEvent({ raceType: 'Marathon', raceDate: '2027-05-23', primaryPriorityConfirmed: true }, primary));
  assert.throws(() => secondary.normalizeSecondaryEvent({ raceType: 'Marathon', raceDate: '2027-03-21' }, { ...primary, maxHours: 5 }), /weekly hours/);
  const weeks = [{ days: {} }];
  assert.equal(secondary.integrateSecondaryEvent(weeks, primary), weeks);
});

test('paused adaptation is unchanged even with partial adherence, and pause dates stop at resume', () => {
  const week = { days: { '2027-01-14': [{ sport: 'run', title: 'Run Threshold', type: 'run_quality', durationMinutes: 60 }] } };
  const result = adaptation.adaptNextWeek({ nextWeek: week, inputs: { plannedCount: 5, completedCount: 1, complianceRatio: 0.2, missedAnchors: [], nextWeekIsRaceWeek: false, nextWeekDeload: false, trainingPaused: true } });
  assert.equal(JSON.stringify(result.week), JSON.stringify(week));
  assert.equal(result.changes.length, 0);
  const pauses = [{ started_date: '2027-01-04', resumed_date: '2027-01-08', status: 'resumed' }];
  assert.equal(pauseHelpers.dateIsPaused('2027-01-07', pauses), true);
  assert.equal(pauseHelpers.dateIsPaused('2027-01-08', pauses), false);
  assert.equal(pauseHelpers.dateIsPaused('2027-01-03', pauses), false);
  assert.equal(pauseHelpers.dateIsPaused('2027-02-01', [{ started_date: '2027-01-04', expected_return_date: '2027-01-05', status: 'paused' }]), true);
});

test('ease back in reduces existing sessions, strips quality prescriptions and preserves race', () => {
  const week = { days: { '2027-01-14': [{ sport: 'run', title: 'Run Threshold', type: 'run_quality', durationMinutes: 60, details: '60min threshold intervals' },
    { sport: 'other', title: 'Race Day', type: 'race_day', durationMinutes: 0 }] } };
  const result = adaptation.adaptNextWeek({ nextWeek: week, inputs: { plannedCount: 0, completedCount: 0, complianceRatio: 1, missedAnchors: [], nextWeekIsRaceWeek: true, nextWeekDeload: false, easeBackIn: true } });
  const [run, race] = result.week.days['2027-01-14'];
  assert.equal(run.durationMinutes, 45);
  assert.equal(run.title, 'Run Easy');
  assert.doesNotMatch(run.details, /threshold|interval/i);
  assert.equal(JSON.stringify(race), JSON.stringify(week.days['2027-01-14'][1]));
  assert.equal(week.days['2027-01-14'][0].durationMinutes, 60);
});

test('paused sessions do not reduce weekly adherence', () => {
  const date = iso(start);
  const summary = weeklySummary.getWeeklySummary([{ id: 's1', date, sport: 'Run', title: 'Easy Run', duration: 40 }], [], [], [{ started_date: date, status: 'paused' }]);
  assert.equal(summary.totalPlanned, 0);
  assert.equal(summary.totalCompleted, 0);
});

test('early linked completion retains planned date, beats legacy status, and avoids missed adaptation', () => {
  const session = { id: 's1', date: '2027-01-07', title: 'Long Run' };
  const rows = [{ session_id: 's1', date: '2027-01-07', session_title: 'Old title', status: 'done', completed_at: '2027-01-06T12:00:00Z' },
    { date: '2027-01-07', session_title: 'Long Run', status: 'skipped' }];
  assert.ok(completion.sessionIsComplete(session, rows));
  assert.ok(completion.completedEarly(session, completion.findCompletion(rows, session)));
  assert.equal(session.date, '2027-01-07');
  assert.ok(completion.sessionIsComplete({ ...session, date: '2027-01-08', title: 'Renamed run' }, rows));
  assert.equal(completion.sessionIsComplete({ ...session, id: 's2' }, rows), false);
  const result = adaptation.adaptNextWeek({ nextWeek: { days: { '2027-01-14': [{ sport: 'run', title: 'Long Run', durationMinutes: 80 }] } },
    inputs: { plannedCount: 1, completedCount: 1, complianceRatio: 1, missedAnchors: [], nextWeekIsRaceWeek: false, nextWeekDeload: false } });
  assert.equal(result.changes.length, 0);
});

test('legacy completion remains usable and skipped rows never count', () => {
  const session = { id: 'new-id', date: '2027-01-07', title: 'Long Run' };
  assert.ok(completion.sessionIsComplete(session, [{ date: session.date, session_title: ' long run ' }]));
  assert.equal(completion.sessionIsComplete(session, [{ date: session.date, session_title: session.title, status: 'skipped' }]), false);
  assert.equal(completion.completedEarly(session, { date: session.date, session_title: session.title }), false);
});

test('weekly summary counts manual completion even alongside unrelated Strava activity', () => {
  const date = iso(start);
  const session = { id: 's1', date, sport: 'Run', title: 'Easy Run', duration: 40 };
  const summary = weeklySummary.getWeeklySummary([session], [{ session_id: 's1', date, session_title: session.title, status: 'done', completed_at: new Date().toISOString() }],
    [{ id: 'a1', sport_type: 'Swim', start_date: date + 'T12:00:00Z', moving_time: 600, distance: 100 }]);
  assert.equal(summary.totalCompleted, 1);
  assert.equal(summary.adherence, 100);
});

test('sport availability survives scaffold and guard, including conflicting preferred days', () => {
  const params = { raceType: '70.3', raceDate: '2027-06-20', maxHours: 10, restDay: 'Monday',
    twoADaysAllowed: true, sportAvailability: { swim: ['Wednesday', 'Thursday'], bike: ['Tuesday', 'Thursday', 'Saturday'], run: ['Tuesday', 'Wednesday', 'Friday', 'Sunday'] } };
  const week = triathlon.buildTriathlonWeekScaffold({ userParams: params,
    weekMeta: { label: 'Week 1', phase: 'Build', startDate: '2027-01-04', deload: false } });
  const result = constraints.enforceTriathlonScheduleConstraints({ weeks: [week], ...params });
  for (const [date, sessions] of Object.entries(result.weeks[0].days)) for (const session of sessions) {
    const day = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
    if (params.sportAvailability[session.sport]) assert.ok(params.sportAvailability[session.sport].includes(day));
    assert.notEqual(day, 'Monday');
  }
});

test('empty or globally blocked swim availability reports a conflict', () => {
  for (const swim of [[], ['Monday']]) assert.throws(() => triathlon.buildTriathlonWeekScaffold({
    userParams: { raceType: '70.3', raceDate: '2027-06-20', maxHours: 8, restDay: 'Monday', sportAvailability: { swim } },
    weekMeta: { label: 'Week 1', phase: 'Base', startDate: '2027-01-04', deload: false },
  }), /available day/);
});

test('omitted availability preserves legacy scaffold', () => {
  const args = { userParams: { raceType: '70.3', raceDate: '2027-06-20', maxHours: 8 },
    weekMeta: { label: 'Week 1', phase: 'Base', startDate: '2027-01-04', deload: false } };
  assert.equal(JSON.stringify(triathlon.buildTriathlonWeekScaffold(args)), JSON.stringify(triathlon.buildTriathlonWeekScaffold({ ...args, userParams: { ...args.userParams, sportAvailability: undefined } })));
});

function metadata(count) {
  return Array.from({ length: count }, (_, i) => ({ label: `Week ${i + 1}`, startDate: iso(addWeeks(start, i)),
    phase: i >= count - 2 ? 'Taper' : i < count / 2 ? 'Base' : 'Build', deload: i > 0 && i < count - 2 && (i + 1) % 4 === 0 }));
}

test('running schedules pass quality and availability checks across 288 profiles without AI', () => {
  let cases = 0;
  for (const raceType of ['5K', '10K', 'Half Marathon', 'Marathon'])
  for (const experience of ['Beginner', 'Intermediate', 'Advanced'])
  for (const count of [1, 2, 16, 60])
  for (const maxHours of [2, 8, 30])
  for (const constrained of [false, true]) {
    const weekMeta = metadata(count);
    const params = { planType: 'running', raceType, experience, maxHours, raceDate: iso(addDays(addWeeks(start, count - 1), 6)),
      restDay: 'Monday', unavailableDays: constrained ? ['Saturday', 'Sunday', 'Wednesday'] : [],
      preferredLongRunDay: constrained ? 'Friday' : 'Sunday', runPace: '7:00 / mi', paceUnit: 'mi' };
    const weeks = builder.buildRunningPlanScaffold({ userParams: params, weekMeta });
    const result = validator.validateGeneratedPlan({ plan: { planType: 'running', params, weeks }, expectedWeeks: count, userParams: params });
    assert.ok(result.ok, JSON.stringify({ raceType, experience, count, maxHours, constrained, result }));
    let prevVolume = 0;
    for (const week of weeks) {
      let volume = 0;
      for (const [date, sessions] of Object.entries(week.days)) {
        assert.ok(date <= params.raceDate || sessions.length === 0);
        for (const session of sessions) {
          if (session.type === 'race_day') continue;
          const day = new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
          assert.notEqual(day, params.restDay);
          assert.ok(!params.unavailableDays.includes(day));
          assert.ok(session.durationMinutes > 0 && session.durationMinutes <= 230);
          volume += session.durationMinutes;
        }
        assert.ok(sessions.length <= 1);
      }
      assert.ok(volume <= maxHours * 60);
      if (prevVolume > 0 && week.deload) assert.ok(volume <= prevVolume * 0.9);
      if (prevVolume > 0) assert.ok(volume <= Math.ceil(prevVolume * 1.08));
      prevVolume = volume;
    }
    assert.equal(weeks.at(-1).days[params.raceDate][0].type, 'race_day');
    cases++;
  }
  assert.equal(cases, 288);
});

test('half marathon uses half-marathon targets', () => {
  const result = targets.computeRunTargets({ userParams: { raceType: 'Half Marathon', maxHours: 8, raceDate: '2027-01-01' }, weekMeta: metadata(16)[0], weekIndex: 0 });
  assert.equal(result.raceFamily, 'half');
});

class AuthError extends Error {}
async function finalize({ athleteContext, athleteNotes, planType = 'running', raceType, maxHours = 8, sportAvailability, secondaryEvent, twoADaysAllowed, persistError = null, unavailableDays = [], restDay = 'Monday', preferredLongRunDay = 'Sunday', raceDate = iso(addDays(addWeeks(start, 59), 6)) } = {}) {
  const calls = [];
  const query = {};
  for (const method of ['select', 'eq', 'gte', 'order', 'limit']) query[method] = () => query;
  query.abortSignal = async signal => {
    assert.ok(signal instanceof AbortSignal);
    // Optional Strava outage must not prevent plan creation.
    return { data: null, error: { message: 'History unavailable' } };
  };
  const route = await load('app/api/finalize-plan/route.ts', {
    'next/server': { NextResponse: { json: Response.json } },
    '@/lib/supabase/server': { AuthError, assertSameUser: () => {}, requireUser: async () => ({ id: 'athlete' }),
      createRouteSupabaseClient: async () => ({ from: () => query, rpc: async (name, args) => {
        calls.push({ name, args });
        return { data: persistError ? null : { plan_id: 'saved-plan', sessions_created: args.p_sessions.length }, error: persistError };
      } }),
    },
  });
  const response = await route.POST(new Request('https://traingpt.co/api/finalize-plan', { method: 'POST', body: JSON.stringify({
    clientUserId: 'athlete', planType, raceType: raceType ?? (planType === 'running' ? 'Half Marathon' : 'Olympic'), raceDate,
    maxHours, experience: 'Intermediate', restDay, unavailableDays, preferredLongRunDay, sportAvailability, secondaryEvent, twoADaysAllowed, athleteContext, athleteNotes,
  }) }));
  return { response, payload: await response.json(), calls };
}

test('60-week running plan saves atomically with no AI key and failed Strava lookup', async () => {
  const { response, payload, calls } = await finalize();
  assert.equal(response.status, 200);
  assert.equal(payload.totalWeeks, 60);
  assert.equal(payload.enrichmentPending, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'replace_plan_and_sessions');
  assert.ok(calls[0].args.p_sessions.length > 200);
});

test('triathlon schedule still saves without an AI key', async () => {
  const { response, payload } = await finalize({ planType: 'triathlon', raceDate: iso(addDays(addWeeks(start, 15), 6)) });
  assert.equal(response.status, 200);
  assert.equal(payload.enrichmentPending, true);
});

test('availability persists through finalize validation, repair and atomic session conversion', async () => {
  const sportAvailability = { swim: ['Wednesday', 'Thursday'], bike: ['Tuesday', 'Thursday', 'Saturday'], run: ['Tuesday', 'Wednesday', 'Friday', 'Sunday'] };
  const result = await finalize({ planType: 'triathlon', raceType: 'Half Ironman (70.3)', maxHours: 10, twoADaysAllowed: true,
    raceDate: iso(addDays(addWeeks(start, 15), 6)), sportAvailability });
  assert.equal(result.response.status, 200, JSON.stringify(result.payload));
  const saved = result.calls[0].args;
  assert.equal(JSON.stringify(saved.p_plan.params.sportAvailability), JSON.stringify(sportAvailability));
  for (const session of saved.p_sessions.filter(s => s.sport === 'swim')) {
    const day = new Date(session.date+'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
    assert.ok(sportAvailability.swim.includes(day));
  }
});

test('70.3 plus marathon saves one plan with both race entries, including a later secondary horizon', async () => {
  for (const secondaryIndex of [7, 25]) {
    const raceDate = iso(addDays(addWeeks(start, 15), 6));
    const secondaryEvent = { raceType: 'Marathon', raceDate: iso(addDays(addWeeks(start, secondaryIndex), 6)) };
    const result = await finalize({ planType: 'triathlon', raceType: 'Half Ironman (70.3)', raceDate, secondaryEvent, maxHours: 10, twoADaysAllowed: true });
    assert.equal(result.response.status, 200, JSON.stringify(result.payload));
    assert.equal(result.calls.length, 1);
    const saved = result.calls[0].args;
    assert.ok(saved.p_plan.weeks.some(w => w.days[secondaryEvent.raceDate]?.some(s => s.type === 'race_day')));
    assert.ok(saved.p_plan.weeks.some(w => w.days[raceDate]?.some(s => s.type === 'race_day')));
    assert.equal(saved.p_plan.weeks.length, Math.max(16, secondaryIndex+1));
  }
});

test('early completed next-week session is protected from adaptation reductions', () => {
  const nextWeek = { days: { '2027-01-14': [{ sport: 'run', title: 'Long Run', priority: 'anchor', durationMinutes: 80 }] } };
  const result = adaptation.adaptNextWeek({ nextWeek, inputs: { plannedCount: 5, completedCount: 1, complianceRatio: 0.2, missedAnchors: [{ title: 'Long Run', durationMinutes: 60 }],
    nextWeekIsRaceWeek: false, nextWeekDeload: false, completedNextWeekSessions: [{ date: '2027-01-14', title: 'Long Run' }] } });
  assert.equal(result.week.days['2027-01-14'][0].durationMinutes, 80);
  assert.equal(result.changes.length, 0);
});

test('persisted 16-week triathlon durations survive finalization, repair and session conversion', async () => {
  for (const maxHours of [8, 10]) for (const secondary of [false, true]) {
    const raceDate = iso(addDays(addWeeks(start, 15), 6));
    const secondaryEvent = secondary ? { raceType: 'Marathon', raceDate: iso(addDays(addWeeks(start, 23), 6)) } : undefined;
    const result = await finalize({ planType: 'triathlon', raceType: 'Half Ironman (70.3)', raceDate, secondaryEvent, maxHours });
    assert.equal(result.response.status, 200, JSON.stringify(result.payload));
    const saved = result.calls[0].args;
    assert.equal(saved.p_plan.metadata.timeBudgetAdjustedWeeks, 0);
    let previousVolume = 0, previousRide = 0, previousRun = 0;
    for (const week of saved.p_plan.weeks.slice(0, 14)) {
      const items = Object.values(week.days).flat();
      const volume = items.reduce((sum, item) => sum + (item.durationMinutes ?? 0), 0);
      assert.ok(volume <= maxHours * 60);
      const dates = new Set(Object.keys(week.days));
      const persisted = saved.p_sessions.filter(session => dates.has(session.date));
      assert.equal(persisted.reduce((sum, session) => sum + (session.duration ?? 0), 0), volume, 'Persistence must preserve final training minutes');
      if (week.deload) continue;
      const ride = items.find(item => item.type === 'long_ride').durationMinutes;
      const run = items.find(item => item.type === 'long_run').durationMinutes;
      assert.ok(volume >= previousVolume * .95, `${maxHours}h secondary=${secondary}: ${week.label} collapsed`);
      assert.ok(ride >= previousRide && run >= previousRun, `${week.label}: anchor collapsed`);
      previousVolume = volume; previousRide = ride; previousRun = run;
    }
    assert.ok(previousRide >= 165 && previousRun >= 90);
  }
});

test('blocked preferred long-run day uses an available day without quality rejection', async () => {
  const { response, payload } = await finalize({ unavailableDays: ['Sunday'] });
  assert.equal(response.status, 200);
  assert.equal(payload.validationScore >= 70, true);
});

test('all days blocked is actionable input validation and never overwrites a plan', async () => {
  const { response, calls } = await finalize({ unavailableDays: ['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] });
  assert.equal(response.status, 400);
  assert.equal(calls.length, 0);
});

test('failed atomic save is not reported as success or retried destructively', async () => {
  const { response, payload, calls } = await finalize({ persistError: { message: 'Database unavailable' } });
  assert.equal(response.status, 500);
  assert.equal(payload.ok, false);
  assert.equal(calls.length, 1);
  assert.match(payload.error, /previous plan is still intact/i);
});

test('confirmed comments and interpretation round-trip through atomic persistence', async () => {
  const athleteNotes = 'I can only swim Wednesday and Thursday. I prefer my long run Sunday.';
  const athleteContext = { version: 1, sourceNotes: athleteNotes, confirmedAt: '2026-09-30T12:00:00Z', context: { sportAvailability: { swim: ['Wednesday', 'Thursday'] }, preferredLongRunDay: 'Sunday' } };
  const { response, calls } = await finalize({ planType: 'triathlon', raceDate: iso(addDays(addWeeks(start, 15), 6)), athleteNotes, athleteContext });
  assert.equal(response.status, 200);
  const plan = calls[0].args.p_plan;
  assert.equal(plan.params.athleteNotes, athleteNotes);
  assert.deepEqual(JSON.parse(JSON.stringify(plan.params.athleteContext)), athleteContext);
  for (const week of plan.weeks) for (const [date, sessions] of Object.entries(week.days)) for (const session of sessions) {
    if (session.sport === 'swim') assert.ok(['Wednesday', 'Thursday'].includes(new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' })));
  }
});

test('customer 70.3 plus later marathon honors confirmed Wed/Thu swims and one weekly budget', async () => {
  const athleteNotes = 'I can only swim Wednesday and Thursday. I sometimes move workouts. I am also doing a marathon later.';
  const athleteContext = { version: 1, sourceNotes: athleteNotes, confirmedAt: '2026-09-30T12:00:00Z', context: { sportAvailability: { swim: ['Wednesday', 'Thursday'] } } };
  const secondaryEvent = { raceType: 'Marathon', raceDate: iso(addDays(addWeeks(start, 23), 6)) };
  const { response, calls, payload } = await finalize({ planType: 'triathlon', raceType: 'Half Ironman (70.3)', maxHours: 10, raceDate: iso(addDays(addWeeks(start, 15), 6)), athleteNotes, athleteContext, secondaryEvent, twoADaysAllowed: true });
  assert.equal(response.status, 200, JSON.stringify(payload)); assert.equal(calls.length, 1);
  const plan = calls[0].args.p_plan;
  assert.equal(plan.params.secondaryEvent.raceDate, secondaryEvent.raceDate);
  for (const week of plan.weeks) {
    let minutes = 0;
    for (const [date, items] of Object.entries(week.days)) for (const s of items) {
      if (s.sport === 'swim') assert.ok(['Wednesday', 'Thursday'].includes(new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' })));
      if (s.type !== 'race_day') minutes += s.durationMinutes ?? 0;
    }
    assert.ok(minutes <= 600, `${week.label}: ${minutes} minutes`);
  }
  assert.ok(plan.weeks.some(w => w.days[secondaryEvent.raceDate]?.some(s => s.type === 'race_day')));
});

test('context conflict returns 422 before the atomic save and protects the old plan', async () => {
  const athleteNotes = 'I can only swim Thursday. Thursday is my rest day.';
  const athleteContext = { version: 1, sourceNotes: athleteNotes, confirmedAt: '2026-09-30T12:00:00Z', context: { sportAvailability: { swim: ['Thursday'] }, restDay: 'Thursday' } };
  const { response, payload, calls } = await finalize({ planType: 'triathlon', athleteNotes, athleteContext });
  assert.equal(response.status, 422);
  assert.equal(payload.code, 'ATHLETE_CONTEXT_CONFLICT');
  assert.match(payload.error, /Thursday.*rest day/);
  assert.equal(calls.length, 0);
});

async function legacyGenerator(create) {
  const scaffold = { ...metadata(1)[0], days: {} };
  const mod = await load('utils/generate-week.ts', {
    openai: { default: class { chat = { completions: { create } }; } },
    '@/lib/coachPrompt': { COACH_SYSTEM_PROMPT: '' },
    '@/lib/runningPrompt': { RUNNING_SYSTEM_PROMPT: '' },
    './buildCoachPrompt': { buildCoachPrompt: () => '' },
    './buildRunningPrompt': { buildRunningPrompt: () => '' },
    './buildTriathlonScaffold': { buildTriathlonWeekScaffold: () => scaffold, applyTriathlonScaffold: ({ scaffold }) => scaffold },
  });
  return { mod, scaffold };
}

test('remaining AI calls use cancellation and disable hidden SDK retries', async () => {
  let options;
  const { mod, scaffold } = await legacyGenerator(async (_, opts) => { options = opts; throw new Error('Provider unavailable'); });
  const result = await mod.generateWeek({ weekMeta: metadata(1)[0], userParams: { raceType: 'Olympic', maxHours: 8 }, deadlineMs: Date.now() + 5000 });
  assert.equal(result, scaffold);
  assert.equal(options.maxRetries, 0);
  assert.ok(options.timeout > 0 && options.timeout <= 4000);
  assert.ok(options.signal instanceof AbortSignal);
});

test('expired AI deadline returns scaffold without starting a model request', async () => {
  let calls = 0;
  const { mod, scaffold } = await legacyGenerator(async () => { calls++; });
  const result = await mod.generateWeek({ weekMeta: metadata(1)[0], userParams: { raceType: 'Olympic', maxHours: 8 }, deadlineMs: Date.now() - 1 });
  assert.equal(result, scaffold);
  assert.equal(calls, 0);
});

test('running enrichment can fail without losing the already-saved schedule', async () => {
  let writes = 0;
  const plan = { planType: 'running', params: { raceType: 'Half Marathon', maxHours: 8 }, weeks: [{ ...metadata(1)[0], days: {} }] };
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: { id: 'saved-plan', plan } }),
    update: () => { writes++; throw new Error('Unexpected write'); } };
  const mod = await load('app/api/enrich-week/route.ts', {
    openai: { default: class {} },
    'next/server': { NextResponse: { json: Response.json } },
    '@/lib/supabase/server': { AuthError, assertSameUser: () => {}, requireUser: async () => ({ id: 'athlete' }),
      createRouteSupabaseClient: async () => ({ from: () => query }) },
  });
  const response = await mod.POST(new Request('https://traingpt.co/api/enrich-week', { method: 'POST',
    body: JSON.stringify({ planId: 'saved-plan', weekIndex: 0, clientUserId: 'athlete' }) }));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.kept, 'scaffold');
  assert.equal(result.enrichedCount, 0);
  assert.equal(writes, 0);
});
