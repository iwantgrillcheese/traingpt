import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from './helpers/load-ts.mjs';
const env = { EMAIL_UNSUBSCRIBE_SECRET: 'a'.repeat(64), SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test', CRON_SECRET: 'cron' };
const id = '00000000-0000-0000-0000-000000000001';
const tokens = await load('lib/emails/unsubscribe.ts', { 'server-only': {} }, env);
function database(rows, fail = false, onSessions = () => {}) {
  return { from(table) {
    if (table === "sessions") onSessions();
    const filters = []; let mutation;
    const query = {
      select() { return query; }, update(value) { mutation = value; return query; },
      eq(key, value) { filters.push(row => row[key] === value); return query; },
      not(key, op, value) { filters.push(row => row[key] !== value); return query; },
      limit() { return query; }, gte() { return query; }, lte() { return query; }, order() { return query; },
      maybeSingle() { return Promise.resolve(result(true)); },
      then(resolve, reject) { return Promise.resolve(result(false)).then(resolve, reject); },
    };
    function result(single) {
      if (fail) return { data: null, error: { message: 'database unavailable' } };
      let data = (table === 'profiles' ? rows : table === 'sessions' ? [{ user_id: id, date: '2026-10-05', sport: 'run', title: 'Easy Run', duration: 30 }] : []).filter(row => filters.every(f => f(row)));
      if (mutation) data.forEach(row => Object.assign(row, mutation));
      return { data: single ? data[0] ?? null : data, error: null };
    }
    return query;
  } };
}
test('tokens bind user/category, reject tampering, expire after a year, and require a secret', async () => {
  for (const category of ['daily', 'weekly']) {
    const token = tokens.createUnsubscribeToken(id, category, 100);
    assert.equal(tokens.verifyUnsubscribeToken(token, 101).category, category);
    assert.equal(tokens.verifyUnsubscribeToken(token, 100 + 365 * 86400), null);
    const [payload, signature] = token.split('.');
    const changed = JSON.parse(Buffer.from(payload, 'base64url'));
    changed.sub = '00000000-0000-0000-0000-000000000002';
    assert.equal(tokens.verifyUnsubscribeToken(`${Buffer.from(JSON.stringify(changed)).toString('base64url')}.${signature}`, 101), null);
    changed.sub = id; changed.category = category === 'daily' ? 'weekly' : 'daily';
    assert.equal(tokens.verifyUnsubscribeToken(`${Buffer.from(JSON.stringify(changed)).toString('base64url')}.${signature}`, 101), null);
  }
  for (const value of ['', 'broken', 'a.b.c', 'x'.repeat(1025)]) assert.equal(tokens.verifyUnsubscribeToken(value), null);
  const missing = await load('lib/emails/unsubscribe.ts', { 'server-only': {} });
  assert.throws(() => missing.createUnsubscribeToken(id, 'daily'), /SECRET/);
});
test('unsubscribe mutates only its signed category/user, is repeatable and fails on database errors', async () => {
  for (const category of ['daily', 'weekly']) {
    const rows = [{ id, daily_email_opt_in: true, weekly_email_opt_in: true, marketing_opt_in: true }, { id: 'other', daily_email_opt_in: true, weekly_email_opt_in: true }];
    const token = tokens.createUnsubscribeToken(id, category);
    assert.equal(await tokens.unsubscribe(database(rows), token), category);
    assert.equal(rows[0][`${category}_email_opt_in`], false);
    assert.equal(rows[0][`${category === 'daily' ? 'weekly' : 'daily'}_email_opt_in`], true);
    assert.equal(rows[0].marketing_opt_in, true);
    assert.equal(rows[1][`${category}_email_opt_in`], true);
    assert.equal(await tokens.unsubscribe(database(rows), token), category);
    await assert.rejects(() => tokens.unsubscribe(database(rows, true), token), /save/);
    assert.equal(await tokens.unsubscribe(database([]), token), null);
    assert.equal(await tokens.unsubscribe({ from() { throw Error('Must not query'); } }, 'bad'), null);
  }
});
for (const [category, name, sender] of [['daily', 'daily-session', 'sendDailySessionEmail'], ['weekly', 'upcoming-week', 'sendUpcomingWeekEmail']]) {
  test(`${category} cron filters opted-out/null users in normal/test mode and rechecks before sending`, async () => {
    for (const opted of [true, false, null]) for (const testMode of [true, false]) {
      const rows = [{ id, email: 'athlete@example.com', [`${category}_email_opt_in`]: opted }];
      let sent = 0;
      const route = await load(`app/api/send-email/${name}/route.ts`, {
        'server-only': {}, 'next/server': { NextResponse: { json: (data, init) => Response.json(data, init) }, NextRequest: Request },
        '@supabase/supabase-js': { createClient: () => database(rows) },
        [`@/lib/emails/send-${name}-email`]: { [sender]: async (args) => { assert.equal(args.userId, id); sent++; } },
      }, env);
      const url = new URL(`https://traingpt.co/api/send-email/${name}?date=2026-10-05${testMode ? '&test=athlete@example.com' : ''}`);
      const response = await route.GET({ nextUrl: url, headers: new Headers({ authorization: 'Bearer cron' }) });
      assert.equal(response.status, 200);
      assert.equal(sent, opted === true ? 1 : 0);
    }
    const rows = [{ id, email: 'athlete@example.com', [category + '_email_opt_in']: true }];
    let sent = 0;
    const raceRoute = await load('app/api/send-email/' + name + '/route.ts', {
      'server-only': {}, 'next/server': { NextResponse: { json: (data, init) => Response.json(data, init) }, NextRequest: Request },
      '@supabase/supabase-js': { createClient: () => database(rows, false, () => { rows[0][category + '_email_opt_in'] = false; }) },
      ['@/lib/emails/send-' + name + '-email']: { [sender]: async () => { sent++; } },
    }, env);
    await raceRoute.GET({ nextUrl: new URL('https://traingpt.co/?date=2026-10-05'), headers: new Headers({ authorization: 'Bearer cron' }) });
    assert.equal(sent, 0, 'Opt-out during cron preparation must be respected');
    assert.equal(await tokens.isTrainingEmailEnabled(database([{ id, email: 'a', [`${category}_email_opt_in`]: false }]), id, 'a', category), false);
    await assert.rejects(() => tokens.isTrainingEmailEnabled(database([], true), id, 'a', category), /check/);
  });
}
test('public unsubscribe route confirms without login and reports invalid tokens/errors', async () => {
  const rows = [{ id, daily_email_opt_in: true }];
  const route = await load('app/unsubscribe/route.ts', { 'server-only': {}, 'next/server': { NextResponse: Response, NextRequest: Request }, '@supabase/supabase-js': { createClient: () => database(rows) } }, env);
  const url = new URL(tokens.createUnsubscribeUrl(id, 'daily'));
  const result = await route.GET({ nextUrl: url });
  assert.equal(result.status, 200);
  assert.match(await result.text(), /unsubscribed from daily workout/);
  assert.equal(result.headers.get('Cache-Control'), 'no-store');
  assert.equal(rows[0].daily_email_opt_in, false);
  url.searchParams.set('token', 'bad');
  assert.equal((await route.GET({ nextUrl: url })).status, 400);
});
