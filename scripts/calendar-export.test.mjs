import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';

// Exercise the actual route/client without credentials or a production database.
// Node 22+ is already the CI runtime; no additional test dependency is needed.
async function loadTs(path, mocks, globals = {}) {
  const context = vm.createContext({ Response, Request, URL, Blob, File, Error, console, ...globals });
  const source = stripTypeScriptTypes(await readFile(new URL(path, import.meta.url), 'utf8'));
  const module = new vm.SourceTextModule(source, { context });
  await module.link((specifier) => {
    assert.ok(mocks[specifier], `Unexpected import: ${specifier}`);
    const values = mocks[specifier];
    return new vm.SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    }, { context });
  });
  await module.evaluate();
  return module.namespace;
}

const session = { id: 'session-1', date: '2026-12-31', sport: 'bike', title: 'Endurance ride', duration: 75, details: 'Easy, steady; ride\nStay relaxed', structured_workout: null };
class AuthError extends Error {}

async function route({ user = { id: 'free-athlete' }, data = [session], error = null } = {}) {
  const calls = [];
  const query = {
    select: () => query,
    eq: (column, value) => { calls.push([column, value]); return query; },
    order: async () => ({ data, error }),
  };
  const mod = await loadTs('../app/api/calendar/export/route.ts', {
    'next/server': { NextResponse: { json: Response.json, redirect: (url) => Response.redirect(url, 307) } },
    '@/lib/supabase/server': {
      AuthError,
      createRouteSupabaseClient: async (req) => {
        assert.ok(req instanceof Request);
        return { from: (table) => { assert.equal(table, 'sessions'); return query; } };
      },
      requireUser: async () => { if (!user) throw new AuthError(); return user; },
    },
  });
  return { response: await mod.GET(new Request('https://traingpt.co/api/calendar/export')), calls };
}

test('free athlete exports only owned sessions as a calendar attachment', async () => {
  const { response, calls } = await route();
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [['user_id', 'free-athlete']]);
  assert.match(response.headers.get('content-type'), /text\/calendar/);
  assert.match(response.headers.get('content-disposition'), /attachment.*\.ics/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const unfolded = (await response.text()).replace(/\r\n /g, '');
  assert.match(unfolded, /^BEGIN:VCALENDAR\r\n/);
  assert.match(unfolded, /DTSTART;VALUE=DATE:20261231/);
  assert.match(unfolded, /DTEND;VALUE=DATE:20270101/);
  assert.match(unfolded, /SUMMARY:TrainGPT: bike · Endurance ride/);
  assert.ok(unfolded.includes('Easy\\, steady\\; ride\\nStay relaxed'));
  assert.match(unfolded, /END:VCALENDAR\r\n$/);
});

test('anonymous requests still require authentication', async () => {
  const { response, calls } = await route({ user: null });
  assert.equal(response.status, 307);
  assert.equal(new URL(response.headers.get('location')).pathname, '/login');
  assert.equal(calls.length, 0);
});

test('empty plans and database errors do not return fake calendar files', async () => {
  assert.equal((await route({ data: [] })).response.status, 404);
  assert.equal((await route({ error: { message: 'unavailable' } })).response.status, 500);
});

async function client({ response = new Response('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n', { headers: { 'Content-Type': 'text/calendar' } }), networkError = false, share, shareError, telemetryError = false } = {}) {
  const events = [], alerts = [];
  let downloads = 0;
  const mod = await loadTs('../utils/exportCalendarClient.ts', {
    '@/lib/analytics/posthog-client': { track: (event, props) => { if (telemetryError) throw new Error('analytics unavailable'); events.push({ event, props }); } },
  }, {
    fetch: async () => { if (networkError) throw new Error('Network unavailable'); return response; },
    window: { location: { href: '' }, alert: (msg) => alerts.push(msg), setTimeout: () => 1 },
    navigator: { canShare: () => !!share, share: async () => { if (shareError) { const e = new Error('share failed'); e.name = shareError; throw e; } } },
    document: { body: { appendChild() {} }, createElement: () => ({ click: () => downloads++, remove() {} }) },
  });
  await mod.exportCalendarClient('test');
  return { events, alerts, downloads };
}

test('download tracks attempt and handoff, not a successful calendar import', async () => {
  const result = await client();
  assert.equal(result.downloads, 1);
  assert.deepEqual(result.events.map(e => e.event), ['calendar_export_clicked', 'calendar_export_handoff']);
  assert.equal(result.events[1].props.method, 'download');
});

test('HTTP and network failures are visible and never count as handoff', async () => {
  for (const opts of [{ response: Response.json({ error: 'No sessions found' }, { status: 404 }) }, { networkError: true }]) {
    const result = await client(opts);
    assert.equal(result.downloads, 0);
    assert.equal(result.alerts.length, 1);
    assert.deepEqual(result.events.map(e => e.event), ['calendar_export_clicked', 'calendar_export_failed']);
  }
});

test('share success is a handoff; cancellation is not an error', async () => {
  const success = await client({ share: true });
  assert.equal(success.events[1].props.method, 'share');
  const cancelled = await client({ share: true, shareError: 'AbortError' });
  assert.equal(cancelled.downloads, 0);
  assert.equal(cancelled.alerts.length, 0);
  assert.equal(cancelled.events[1].event, 'calendar_export_cancelled');
});

test('share permission failures fall back to download', async () => {
  const result = await client({ share: true, shareError: 'NotAllowedError' });
  assert.equal(result.downloads, 1);
  assert.equal(result.events[1].props.method, 'download');
});

test('broken analytics cannot prevent export', async () => {
  const result = await client({ telemetryError: true });
  assert.equal(result.downloads, 1);
  assert.equal(result.alerts.length, 0);
});
