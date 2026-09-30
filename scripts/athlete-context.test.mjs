import assert from 'node:assert/strict';
import { test } from 'node:test';
import { writeFile } from 'node:fs/promises';
import { load } from './helpers/load-ts.mjs';

const context = await load('utils/athleteContext.ts');
const scheduler = await load('utils/scheduleAthleteContext.ts');
const tri = await load('utils/buildTriathlonScaffold.ts');
const run = await load('utils/buildRunningScaffold.ts');
const guards = await load('utils/enforceTriathlonScheduleConstraints.ts');
const budget = await load('utils/enforceTriathlonTimeBudget.ts');
const validation = await load('utils/validateGeneratedPlan.ts');
const extraction = await load('utils/athleteContextExtraction.ts');
const confirmed = (c, notes = 'test') => ({ version: 1, sourceNotes: notes, confirmedAt: '2026-09-30T12:00:00Z', context: c });
const metas = Array.from({ length: 20 }, (_, i) => ({ label: `Week ${i + 1}`, startDate: new Date(Date.UTC(2026, 8, 28 + i * 7)).toISOString().slice(0, 10), phase: i < 8 ? 'Base' : i < 16 ? 'Build' : i < 18 ? 'Peak' : 'Taper', deload: i < 16 && (i + 1) % 4 === 0 }));
const params = { planType: 'triathlon', raceType: 'Half Ironman (70.3)', raceDate: '2027-02-14', experience: 'Intermediate', maxHours: 10, restDay: 'Monday', preferredLongRideDay: 'Saturday', preferredLongRunDay: 'Sunday', twoADaysAllowed: false };
const weekday = date => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
const totals = week => Object.values(week.days).flat().filter(s => s.type !== 'race_day').reduce((n, s) => n + (s.durationMinutes ?? 0), 0);

// Mock model outputs exercise the real authenticated endpoint, schema and validator.
// These fixtures do not claim to measure a live model's semantic accuracy.
const fixtures = [
  ['I can only swim Wednesday and Thursday.', { sportAvailability: { swim: ['Wednesday', 'Thursday'] } }],
  ['I prefer swimming Wednesday.', { preferences: [{ text: 'Prefer swimming Wednesday', strength: 'preference' }] }],
  ['I cannot train Friday.', { unavailableDays: ['Friday'] }],
  ['I play hard soccer every Tuesday.', { recurringCommitments: [{ day: 'Tuesday', activity: 'Soccer', intensity: 'hard' }] }],
  ['I want my long run Sunday.', { preferredLongRunDay: 'Sunday' }],
  ['I’m racing a marathon November 8 after my 70.3.', { secondaryEvent: { raceType: 'Marathon', raceDate: null }, preferences: [{ text: 'Marathon November 8, year needs confirmation', strength: 'context' }] }],
  ['I’m racing a marathon November 8, 2027 after my 70.3.', { secondaryEvent: { raceType: 'Marathon', raceDate: '2027-11-08' } }],
  ['My knee sometimes hurts.', { preferences: [{ text: 'My knee sometimes hurts.', strength: 'context' }] }],
  ['I can only swim Thursday. Thursday is my rest day.', { sportAvailability: { swim: ['Thursday'] }, restDay: 'Thursday' }],
];

for (const [notes, expected] of fixtures) test(`interpretation contract: ${notes}`, async () => {
  let calls = 0;
  const route = await load('app/api/athlete-context/interpret/route.ts', {
    'next/server': { NextResponse: { json: Response.json } },
    '@/lib/supabase/server': { AuthError: class extends Error {}, requireUser: async () => ({ id: 'athlete' }), createRouteSupabaseClient: async () => ({}) },
    openai: { default: class { chat = { completions: { create: async request => {
      calls++; assert.equal(request.response_format.type, 'json_schema'); assert.equal(request.response_format.json_schema.strict, true);
      assert.equal(request.response_format.json_schema.schema.additionalProperties, false);
      assert.equal(request.messages[1].content, notes);
      assert.match(request.messages[0].content, /never exclusive availability/);
      return { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(expected) } }] };
    } } }; } },
  }, { OPENAI_API_KEY: 'mock-key' });
  // VM env deliberately isolates real credentials; endpoint requires an API key to call the mock.
  // Use loader env parameter below.
  const response = await route.POST(new Request('https://brick.test/api/athlete-context/interpret', { method: 'POST', body: JSON.stringify({ notes }) }));
  assert.equal(response.status, 200); assert.equal(calls, 1);
  assert.deepEqual(await response.json(), { context: expected });
});

test('validator drops malformed/unknown fields and impossible dates; confirmation rejects weakened rules', () => {
  const c = context.validateAthleteContext({ sportAvailability: { swim: ['Funday'], soccer: ['Tuesday'] }, unavailableDays: ['Friday', 'Funday'], restDay: 'Funday', secondaryEvent: { raceType: 'Marathon', raceDate: '2027-02-30' }, injuryRule: 'no running', twoADaysAllowed: 'yes' });
  assert.deepEqual(JSON.parse(JSON.stringify(c)), { secondaryEvent: { raceType: 'Marathon', raceDate: null } });
  assert.throws(() => context.validateConfirmedContext(confirmed({ unavailableDays: ['Funday'] }), 'test'));
  assert.throws(() => context.validateConfirmedContext(confirmed({ unavailableDays: ['Friday'] }), 'changed notes'));
  assert.equal(context.validateConfirmedContext(undefined, 'legacy'), undefined);
});

test('20-week acceptance plan respects availability, soccer, long runs and preserves every duration', async () => {
  const notes = 'I can only swim Wednesday and Thursday. I play soccer Tuesday evenings. I prefer my long run Sunday.';
  const c = { sportAvailability: { swim: ['Wednesday', 'Thursday'] }, recurringCommitments: [{ day: 'Tuesday', activity: 'Soccer in the evening' }], preferredLongRunDay: 'Sunday' };
  const p = { ...params, athleteNotes: notes, athleteContext: confirmed(c, notes) };
  const raw = metas.map((meta, index) => tri.buildTriathlonWeekScaffold({ userParams: p, weekMeta: meta, index, totalWeeks: metas.length }));
  const scheduled = guards.enforceTriathlonScheduleConstraints({ weeks: raw, ...p });
  assert.equal(scheduled.droppedSessions, 0);
  const weeks = budget.enforceTriathlonTimeBudget({ weeks: scheduled.weeks, maxHours: p.maxHours, raceDate: p.raceDate }).weeks;
  const baseline = metas.map((meta, index) => tri.buildTriathlonWeekScaffold({ userParams: params, weekMeta: meta, index, totalWeeks: metas.length }));
  const diagnostic = [];
  for (const [i, week] of weeks.entries()) {
    assert.equal(totals(raw[i]), totals(baseline[i]), `${week.label} scaffold durations changed`);
    assert.ok(totals(week) <= params.maxHours * 60);
    for (const [date, sessions] of Object.entries(week.days)) for (const s of sessions) {
      const day = weekday(date);
      if (s.sport === 'swim') assert.ok(['Wednesday', 'Thursday'].includes(day));
      if (s.type === 'long_run') assert.equal(day, 'Sunday');
      if (/quality/.test(s.type) && ['run', 'bike'].includes(s.sport)) assert.ok(!['Monday', 'Tuesday', 'Wednesday'].includes(day), `${week.label}: ${s.type} ${day}`);
      if (s.type !== 'race_day') assert.ok(s.durationMinutes >= 10);
    }
    diagnostic.push({ week: i + 1, phase: week.phase, deload: week.deload, baselineMinutes: totals(baseline[i]), constrainedMinutes: totals(week), sessions: Object.values(week.days).flat().length });
  }
  assert.ok(diagnostic[16].constrainedMinutes > diagnostic[0].constrainedMinutes);
  assert.ok(diagnostic[19].constrainedMinutes < diagnostic[17].constrainedMinutes);
  const result = validation.validateGeneratedPlan({ plan: { planType: 'triathlon', params: p, weeks }, expectedWeeks: 20, userParams: p });
  assert.ok(result.ok, JSON.stringify(result));
  scheduler.assertAthleteContextHonored(weeks, p);
  if (process.env.ATHLETE_CONTEXT_OUTPUT_DIR) {
    await writeFile(`${process.env.ATHLETE_CONTEXT_OUTPUT_DIR}/representative-plan.json`, JSON.stringify({ planType: 'triathlon', params: p, weeks }, null, 2));
    await writeFile(`${process.env.ATHLETE_CONTEXT_OUTPUT_DIR}/duration-diagnostics.json`, JSON.stringify(diagnostic, null, 2));
    await writeFile(`${process.env.ATHLETE_CONTEXT_OUTPUT_DIR}/extraction-prompt-and-schema.json`, JSON.stringify({ prompt: extraction.ATHLETE_CONTEXT_PROMPT, schema: extraction.ATHLETE_CONTEXT_SCHEMA }, null, 2));
  }
});

test('hard Friday block and explicit avoid-hard rules are respected in both engines', () => {
  const c = { unavailableDays: ['Friday'], avoidHardTrainingDays: ['Wednesday'], preferredLongRunDay: 'Sunday', recurringCommitments: [{ day: 'Tuesday', activity: 'Soccer', intensity: 'hard' }] };
  const p = { ...params, athleteContext: confirmed(c) };
  for (const planType of ['triathlon', 'running']) {
    const input = { ...p, planType, raceType: planType === 'running' ? 'Marathon' : p.raceType };
    const weeks = planType === 'running' ? run.buildRunningPlanScaffold({ userParams: input, weekMeta: metas }) : metas.map((meta, index) => tri.buildTriathlonWeekScaffold({ userParams: input, weekMeta: meta, index, totalWeeks: 20 }));
    for (const week of weeks) for (const [date, sessions] of Object.entries(week.days)) for (const s of sessions) {
      if (s.type === 'race_day') continue;
      assert.notEqual(weekday(date), 'Friday');
      if (/quality/.test(s.type)) assert.notEqual(weekday(date), 'Wednesday');
      if (s.type === 'long_run') assert.equal(weekday(date), 'Sunday');
    }
  }
});

test('rest day versus only swim day surfaces conflict without moving swim elsewhere', () => {
  const p = { ...params, athleteContext: confirmed({ sportAvailability: { swim: ['Thursday'] }, restDay: 'Thursday' }) };
  assert.throws(() => tri.buildTriathlonWeekScaffold({ userParams: p, weekMeta: metas[0] }), /Thursday.*rest day/);
});

test('running ignores triathlon-only availability and old scaffolds are unchanged', () => {
  const input = { ...params, planType: 'running', raceType: 'Marathon' };
  const baseline = run.buildRunningPlanScaffold({ userParams: input, weekMeta: metas });
  const constrained = run.buildRunningPlanScaffold({ userParams: { ...input, athleteContext: confirmed({ sportAvailability: { swim: ['Monday'] } }) }, weekMeta: metas });
  assert.deepEqual(JSON.parse(JSON.stringify(constrained)), JSON.parse(JSON.stringify(baseline)));
  const week = tri.buildTriathlonWeekScaffold({ userParams: params, weekMeta: metas[0] });
  assert.equal(scheduler.scheduleAthleteContext(week, params), week);
});

test('60-week constrained plans preserve later-week progression and context-only comments preserve legacy scheduling', () => {
  const longMetas = Array.from({ length: 60 }, (_, i) => ({ label: `Week ${i + 1}`, startDate: new Date(Date.UTC(2026, 8, 28 + i * 7)).toISOString().slice(0, 10), phase: i < 28 ? 'Base' : i < 56 ? 'Build' : i < 58 ? 'Peak' : 'Taper', deload: i < 56 && (i + 1) % 4 === 0 }));
  const p = { ...params, raceDate: new Date(Date.UTC(2026, 8, 28 + 59 * 7 + 6)).toISOString().slice(0, 10) };
  const constrained = { ...p, athleteContext: confirmed({ sportAvailability: { swim: ['Wednesday', 'Thursday'] }, recurringCommitments: [{ day: 'Tuesday', activity: 'Soccer' }], preferredLongRunDay: 'Sunday' }) };
  for (const [i, meta] of longMetas.entries()) {
    const baseline = tri.buildTriathlonWeekScaffold({ userParams: p, weekMeta: meta, index: i, totalWeeks: 60 });
    const week = tri.buildTriathlonWeekScaffold({ userParams: constrained, weekMeta: meta, index: i, totalWeeks: 60 });
    assert.equal(totals(week), totals(baseline), `${meta.label} unexpectedly changed volume`);
    scheduler.assertAthleteContextHonored([week], constrained);
    if (meta.phase === 'Build' && !meta.deload) assert.ok(totals(week) > 400);
  }
  const baseline = tri.buildTriathlonWeekScaffold({ userParams: p, weekMeta: metas[0] });
  const onlyContext = { ...p, athleteContext: confirmed({ preferences: [{ text: 'My knee sometimes hurts.', strength: 'context' }] }) };
  assert.equal(scheduler.scheduleAthleteContext(baseline, onlyContext), baseline);
  const before = guards.enforceTriathlonScheduleConstraints({ weeks: [baseline], ...p });
  const after = guards.enforceTriathlonScheduleConstraints({ weeks: [baseline], ...onlyContext });
  assert.deepEqual(JSON.parse(JSON.stringify(after)), JSON.parse(JSON.stringify(before)));
});
