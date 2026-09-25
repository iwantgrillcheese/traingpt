import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import { addDays, addWeeks, formatISO, startOfWeek } from 'date-fns';

const root = new URL('../', import.meta.url);
async function load(path, mocks = {}) {
  const context = vm.createContext({ Response, Request, URL, AbortSignal, console, process: { env: {} } });
  const cache = new Map();
  async function resolve(specifier, parent = root.href) {
    if (cache.has(specifier) && mocks[specifier]) return cache.get(specifier);
    if (mocks[specifier] || !specifier.startsWith('.') && !specifier.startsWith('@/') && !specifier.startsWith('file:')) {
      // These tests must never reach AI, even when OPENAI_API_KEY is absent.
      assert.ok(specifier !== 'openai' || mocks[specifier], 'Plan creation must not depend on AI');
      const values = mocks[specifier] ?? await import(specifier);
      const mod = new vm.SyntheticModule(Object.keys(values), function () {
        for (const [key, value] of Object.entries(values)) this.setExport(key, value);
      }, { context });
      cache.set(specifier, mod);
      return mod;
    }
    const url = specifier.startsWith('@/') ? new URL(specifier.slice(2), root) : new URL(specifier, parent);
    if (!url.pathname.endsWith('.ts')) url.pathname += '.ts';
    if (cache.has(url.href)) return cache.get(url.href);
    const source = stripTypeScriptTypes(await readFile(url, 'utf8'));
    const mod = new vm.SourceTextModule(source, { context, identifier: url.href,
      importModuleDynamically: async (specifier, parent) => {
        const child = await resolve(specifier, parent.identifier);
        if (child.status === 'unlinked') await child.link((s, p) => resolve(s, p.identifier));
        if (child.status === 'linked') await child.evaluate();
        return child;
      },
    });
    cache.set(url.href, mod);
    await mod.link((s, p) => resolve(s, p.identifier));
    return mod;
  }
  const mod = await resolve(new URL(path, root).href);
  await mod.evaluate();
  return mod.namespace;
}

const iso = date => formatISO(date, { representation: 'date' });
const start = startOfWeek(new Date(), { weekStartsOn: 1 });
const builder = await load('utils/buildRunningScaffold.ts');
const validator = await load('utils/validateGeneratedPlan.ts');
const targets = await load('utils/runTargets.ts');

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
async function finalize({ planType = 'running', persistError = null, unavailableDays = [], restDay = 'Monday', preferredLongRunDay = 'Sunday', raceDate = iso(addDays(addWeeks(start, 59), 6)) } = {}) {
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
    clientUserId: 'athlete', planType, raceType: planType === 'running' ? 'Half Marathon' : 'Olympic', raceDate,
    maxHours: 8, experience: 'Intermediate', restDay, unavailableDays, preferredLongRunDay,
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
