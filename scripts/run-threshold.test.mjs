import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';
const now = Date.parse('2026-09-29T12:00:00Z');
const source = stripTypeScriptTypes(await readFile(new URL('../lib/strava/run-threshold.ts', import.meta.url), 'utf8'));
const context = vm.createContext({});
const mod = new vm.SourceTextModule(source, { context });
await mod.link(() => { throw new Error('Unexpected import'); }); await mod.evaluate();
const estimate = (runs, anchor) => mod.namespace.estimateRunThreshold(runs, anchor, now);
const run = (pace, day = 1, extra = {}) => ({ name:'Steady run', distance:10000, moving_time:pace * 10000 / 1609.344, start_date:new Date(now-day*86400000).toISOString(), average_heartrate:null, ...extra });
const base = () => [run(400, 1),run(405, 5),run(410, 10)];
const seconds = result => { const [m,s] = result.value.split(' / ')[0].split(':').map(Number); return m*60+s; };
test('consistent recent runs form a sensible conservative cluster without HR', () => {
  const r=estimate(base()); assert.equal(r.confidence,'medium'); assert.ok(seconds(r)>=410 && seconds(r)<=425); assert.match(r.rationale,/3 consistent/);
});
test('one extremely fast outlier cannot dominate, even when marked race', () => {
  for (const workout_type of [null,1]) { const r=estimate([...base(),run(270,2,{workout_type})]); assert.equal(r.value,estimate(base()).value); assert.match(r.rationale,/outlier/); }
});
test('interval, brick, downhill and paused activities are rejected', () => {
  for (const extra of [{name:'6 x 1000 intervals'},{name:'Bike-run brick'},{name:'Downhill run'},{elapsed_time:5000}]) {
    const r=estimate([...base(),run(290,2,extra)],430); assert.ok(seconds(r)>=417); assert.match(r.rationale,/abnormal/);
  }
});
test('explicit recent race influences estimate while distance match alone is ordinary training', () => {
  const runs=[run(410,1),run(415,5),run(400,10)];
  const plain=estimate(runs); const race=estimate([...runs.slice(0,2),run(400,10,{workout_type:1})]);
  assert.ok(seconds(race)<seconds(plain)); assert.match(race.rationale,/race performance/); assert.doesNotMatch(plain.rationale,/race performance/);
});
test('old PR and future/invalid dates do not affect current fitness', () => {
  for (const extra of [run(270,90,{workout_type:1}),run(270,-1),run(270,1,{start_date:'bad'})]) assert.equal(estimate([...base(),extra]).value,estimate(base()).value);
});
test('isolated, conflicting, recovery and insufficient evidence preserve anchor or decline estimate', () => {
  for (const runs of [[],[run(400)],[run(300),run(500,3)],[run(400,1,{name:'Recovery'})]]) {
    assert.equal(estimate(runs).value,'Not enough consistent run data'); assert.equal(estimate(runs,450).value,'7:30 / mi'); assert.equal(estimate(runs).confidence,'low');
  }
});
test('existing manual threshold is never mutated; unsupported changes capped at 3%', () => {
  const runs=base(); const before=JSON.stringify(runs); const r=estimate(runs,480);
  assert.ok(seconds(r)>=Math.floor(480*.97)); assert.equal(r.confidence,'low'); assert.match(r.rationale,/suggestion only/); assert.equal(JSON.stringify(runs),before);
});
test('relative HR rejects low-HR fast signal and corroborates consistent efforts', () => {
  const runs=[run(450,20,{average_heartrate:145}),run(445,21,{average_heartrate:145}),run(440,22,{average_heartrate:145}),...base().map(r=>({...r,average_heartrate:170,elapsed_time:r.moving_time}))];
  assert.equal(estimate(runs).confidence,'high'); assert.equal(estimate([...runs,run(385,2,{average_heartrate:100})]).value,estimate(runs).value);
});
test('training profile keeps API contract, scopes queries and never writes threshold', async () => {
  const calls=[]; const client={from(table){ const q={table};const chain={select(cols){q.cols=cols;return chain;},eq(k,v){(q.filters??=[]).push([k,v]);return chain;},gte(){return chain;},order(){return chain;},limit(){return chain;},maybeSingle(){return chain;},then(resolve){calls.push(q);return Promise.resolve({data:table==='profiles'?{run_threshold_per_mile:300,run_pace_unit:'km'}:base().map(r=>({...r,sport_type:'Run'})),error:null}).then(resolve);}};return chain;}};
  class AuthError extends Error {}
  const ctx=vm.createContext({Date:class extends Date {static now(){return now;}},console,Response});
  const route=new vm.SourceTextModule(stripTypeScriptTypes(await readFile(new URL('../app/api/strava/training-profile/route.ts',import.meta.url),'utf8')),{context:ctx});
  const mocks={'next/server':{NextResponse:{json:Response.json}},'@/lib/supabase/server':{AuthError,createRouteSupabaseClient:async()=>client,requireUser:async()=>({id:'athlete'})},'@/lib/strava/run-threshold':{estimateRunThreshold:(r,s)=>estimate(r,s)}};
  await route.link(spec=>new vm.SyntheticModule(Object.keys(mocks[spec]),function(){for(const [k,v] of Object.entries(mocks[spec]))this.setExport(k,v);},{context:ctx}));await route.evaluate();
  const response=await route.namespace.GET();assert.equal(response.status,200);const body=await response.json();assert.equal(body.estimates.length,3);assert.deepEqual(Object.keys(body.estimates[2]).sort(),['confidence','discipline','label','rationale','value']);assert.ok(seconds(body.estimates[2])>=468);
  assert.ok(calls.every(q=>q.filters.some(([k,v])=>v==='athlete'&&(k==='id'||k==='user_id'))));
});
