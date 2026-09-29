import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes, createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import * as crypto from 'node:crypto';

const require = createRequire(import.meta.url);
// Can reuse an existing install while testing an isolated worktree.
const ts = require(process.env.STRAVA_TEST_TYPESCRIPT || 'typescript');
class AuthError extends Error { status = 401; }
const quiet = { info() {}, error() {}, warn() {}, log() {} };
async function load(path, mocks, globals = {}) {
  const raw = await readFile(new URL(path, import.meta.url), 'utf8');
  const source = path.endsWith('.tsx') ? ts.transpileModule(raw, { compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText : stripTypeScriptTypes(raw);
  const context = vm.createContext({ Response, Request, URL, URLSearchParams, Buffer, console: quiet, process: { env: { STRAVA_CLIENT_ID: 'client', STRAVA_CLIENT_SECRET: 'secret' } }, ...globals });
  const mod = new vm.SourceTextModule(source, { context });
  await mod.link(spec => {
    const values = mocks[spec]; assert.ok(values, `Unexpected import: ${spec}`);
    return new vm.SyntheticModule(Object.keys(values), function () { for (const [k,v] of Object.entries(values)) this.setExport(k,v); }, { context });
  });
  await mod.evaluate(); return mod.namespace;
}

function database({ legacy = false, dropWrites = false, dbError = false } = {}) {
  const state = { rows: [], profile: { id: 'new-user', strava_access_token: 'token', strava_refresh_token: 'refresh', strava_expires_at: 9999999999, strava_athlete_id: 'athlete' }, calls: [] };
  const client = { from(table) {
    const q = { table, filters: [], cols: '*', action: 'select', singleRow: false, lo: 0, hi: 999 };
    const query = {
      select(cols, opts) { q.cols = cols; q.opts = opts; return query; },
      eq(col,val) { q.filters.push([col,val]); return query; },
      in(col,vals) { q.ids = [col,vals]; return query; },
      order() { return query; }, limit(n) { q.hi = n-1; return query; }, range(lo,hi) { q.lo=lo; q.hi=hi; return query; },
      maybeSingle() { q.singleRow = true; return query; }, single() { q.singleRow = true; return query; },
      update(values) { q.action='update'; q.values=values; return query; },
      upsert(values,opts) { q.action='upsert'; q.values=values; q.upsert=opts; return query; },
      then(resolve,reject) { return Promise.resolve().then(() => {
        state.calls.push(q);
        if (dbError) return { data:null,error:{message:'db down'} };
        if (table === 'profiles') {
          const match = state.profile && q.filters.every(([k,v])=>state.profile[k]===v);
          if (q.action==='update' && match) Object.assign(state.profile,q.values);
          return { data:match ? state.profile:null, error:!match && q.singleRow ? {message:'missing profile'}:null };
        }
        if (q.action==='upsert') {
          let count=0;
          for (const row of q.values) {
            const duplicate=state.rows.some(r=>r.strava_id===row.strava_id && (legacy || r.user_id===row.user_id));
            if (duplicate && legacy && q.upsert.onConflict!=='strava_id') return {error:{message:'global unique constraint'},count:0};
            if (!duplicate && !dropWrites) { state.rows.push({...row}); count++; }
          }
          return {error:null,count};
        }
        let rows = state.rows.filter(r=>q.filters.every(([k,v])=>r[k]===v));
        if (q.ids) rows=rows.filter(r=>q.ids[1].includes(r[q.ids[0]]));
        const count=rows.length; rows=rows.slice(q.lo,q.hi+1);
        return { data:q.singleRow ? rows[0]??null:rows,error:null,count };
      }).then(resolve,reject); }
    }; return query;
  } };
  return { state, client };
}
const activity = (id, sport='Run') => ({ id, name:`Activity ${id}`, sport_type:sport, start_date:'2026-08-03T12:00:00Z', distance:10000, moving_time:3600 });
async function routes(db, history, { fetchFailure=false, invalid=false, expired=false }={}) {
  const requests=[];
  if (expired) db.state.profile.strava_expires_at=0;
  const fetch = async (url, opts) => {
    requests.push(String(url));
    if (String(url).endsWith('/oauth/token')) return Response.json({ access_token:'new-token',refresh_token:'new-refresh',expires_at:9999999999,athlete:{id:'athlete'} });
    if (fetchFailure) return Response.json({message:'rate limited'},{status:429});
    if (invalid) return Response.json({message:'not an activity list'});
    const page=Number(new URL(url).searchParams.get('page'));
    return Response.json(history.slice((page-1)*200,page*200));
  };
  const mocks = { 'next/server':{NextResponse:{json:Response.json,redirect:u=>Response.redirect(u,307)}}, '@/lib/supabase/server':{AuthError,createRouteSupabaseClient:async()=>db.client,requireUser:async()=>({id:'new-user'})} };
  const sync = await load('../app/api/strava_sync/route.ts',mocks,{fetch});
  const reveal = await load('../app/api/strava/reveal/route.ts',mocks);
  const callback = await load('../app/api/strava/callback/route.ts',{...mocks,crypto,'@supabase/supabase-js':{createClient:()=>db.client}},{fetch});
  return { requests, sync:async(forceBackfill=true)=>sync.POST(new Request('https://app/api/strava_sync',{method:'POST',body:JSON.stringify({forceBackfill})})), reveal:()=>reveal.GET(new Request('https://app/api/strava/reveal')), connect:()=>callback.GET(new Request('https://app/api/strava/callback?code=code&state=%2Fplan')) };
}

test('new OAuth connection imports another app account’s athlete history and reveal sees all 1205 rows',async()=>{
  const db=database(); const history=Array.from({length:1205},(_,i)=>activity(i+1,['Run','Ride','Swim','VirtualRide','TrailRun'][i%5]));
  db.state.rows=history.map(a=>({...a,strava_id:a.id,user_id:'original-user'}));
  const r=await routes(db,history);
  assert.equal((await r.connect()).headers.get('location'),'https://app/strava-reveal?success=strava_connected');
  assert.equal((await r.reveal()).status,409);
  const response=await r.sync(); assert.equal(response.status,200); assert.equal((await response.json()).inserted,1205);
  const reveal=await (await r.reveal()).json(); assert.equal(reveal.enduranceActivityCount,1205); assert.ok(reveal.highlights.longestRide); assert.ok(reveal.highlights.longestRun); assert.ok(reveal.highlights.longestSwim);
  assert.equal(db.state.rows.filter(a=>a.user_id==='original-user').length,1205);
  assert.equal((await (await r.sync()).json()).inserted,0);
  await r.connect(); assert.equal((await r.reveal()).status,409); await r.sync();
  assert.equal(db.state.rows.length,2410);
  assert.equal((await (await r.reveal()).json()).enduranceActivityCount,1205);
});
test('original global uniqueness defect cannot masquerade as completed zero history',async()=>{
  const db=database({legacy:true}); db.state.rows=[{strava_id:1,user_id:'original-user'}];
  const r=await routes(db,[activity(1)]); assert.equal((await r.sync()).status,500); assert.equal((await r.reveal()).status,409);
});
test('simultaneous imports remain idempotent under the per-user conflict key',async()=>{
  const db=database(); const r=await routes(db,Array.from({length:773},(_,i)=>activity(i+1)));
  const responses=await Promise.all([r.sync(),r.sync()]); assert.ok(responses.every(r=>r.status===200));
  assert.equal(db.state.rows.length,773); assert.equal((await (await r.reveal()).json()).enduranceActivityCount,773);
});
test('OAuth cannot report connection success when profile persistence affects no rows',async()=>{
  const db=database(); db.state.profile=null; const r=await routes(db,[]);
  assert.match((await r.connect()).headers.get('location'),/error=strava_profile_update_failed/);
});
test('successful empty history and unsupported-only history yield true zero',async()=>{
  for (const history of [[],[activity(1,'Yoga')]]) {
    const db=database(); const r=await routes(db,history); assert.equal((await r.sync()).status,200);
    assert.equal((await (await r.reveal()).json()).enduranceActivityCount,0); assert.ok(db.state.profile.strava_history_imported_at);
  }
});
test('fetch, malformed responses, missing writes and database failures do not complete import; retry recovers',async()=>{
  for (const config of [{fetchFailure:true},{invalid:true},{dropWrites:true},{dbError:true}]) {
    const db=database(config); const r=await routes(db,[activity(1)],config);
    assert.equal((await r.sync()).status,500); assert.equal(db.state.profile.strava_history_imported_at,undefined);
  }
  const db=database(); await (await routes(db,[activity(1)],{fetchFailure:true})).sync();
  const r=await routes(db,[activity(1)]); assert.equal((await r.sync()).status,200); assert.equal((await (await r.reveal()).json()).enduranceActivityCount,1);
});
test('history safety cap is an incomplete import error',async()=>{
  const db=database(); const r=await routes(db,Array.from({length:10000},(_,i)=>activity(i+1)));
  assert.equal((await r.sync()).status,500); assert.equal(db.state.profile.strava_history_imported_at,undefined);
});
test('normal incremental sync and expired token refresh remain supported',async()=>{
  const db=database(); db.state.rows=Array.from({length:12},(_,i)=>({...activity(i+1),strava_id:i+1,user_id:'new-user'}));
  const r=await routes(db,[activity(13)],{expired:true}); const result=await (await r.sync(false)).json();
  assert.equal(result.mode,'incremental'); assert.equal(result.inserted,1); assert.equal(db.state.rows.length,13);
  assert.ok(r.requests.some(u=>u.includes('after='))); assert.equal(db.state.profile.strava_access_token,'new-token');
});
test('legacy Run/Ride variants participate in reveal calculations',async()=>{
  const db=database(); db.state.profile.strava_history_imported_at='2026-09-29';
  db.state.rows=['Ride','VirtualRide','MountainBikeRide','GravelRide','EBikeRide','EMountainBikeRide','Run','TrailRun','VirtualRun','Swim'].map((sport,i)=>({...activity(i+1,sport),strava_id:i+1,user_id:'new-user'}));
  const r=await routes(db,[]); const result=await (await r.reveal()).json(); assert.equal(result.enduranceActivityCount,10);
});

// Execute the real page component with a minimal hook scheduler and JSX tree.
async function page(fetch) {
  let states=[],cursor=0,effect; const element=(type,props)=>({type,props});
  const mod=await load('../app/strava-reveal/page.tsx',{
    react:{useState:init=>{const i=cursor++; if (!(i in states)) states[i]=init; return [states[i],v=>states[i]=typeof v==='function'?v(states[i]):v];},useEffect:fn=>{effect??=fn;}},
    'react/jsx-runtime':{jsx:element,jsxs:element},
    'next/navigation':{useRouter:()=>({replace(){}})},
    '@/app/components/StravaReveal':{default:'Reveal'},
    '@/lib/analytics/posthog-client':{track(){}},
  },{fetch,location:{reload(){}}});
  const render=()=>{cursor=0;return mod.default();};
  const initial=render(); effect(); return {initial,render};
}
test('page shows analyzing until completed import, then mounts reveal; incomplete and failed import expose retry',async()=>{
  let resolve; const p=await page(()=>new Promise(r=>resolve=r));
  assert.match(JSON.stringify(p.initial),/Analyzing your Strava history/); assert.doesNotMatch(JSON.stringify(p.initial),/"type":"Reveal"/);
  resolve(Response.json({historyComplete:true,totalFetched:773})); await new Promise(r=>setImmediate(r));
  assert.match(JSON.stringify(p.render()),/"type":"Reveal"/);
  for (const response of [Response.json({historyComplete:false}),Response.json({error:'failed'},{status:500})]) {
    const p=await page(async()=>response); await new Promise(r=>setImmediate(r)); assert.match(JSON.stringify(p.render()),/Retry import/); assert.doesNotMatch(JSON.stringify(p.render()),/"type":"Reveal"/);
  }
});
test('reveal component renders true-zero and recoverable query failure states',async()=>{
  for (const failure of [false,true]) {
    let states=[],cursor=0,effect;
    const element=(type,props)=>({type,props});
    const mod=await load('../app/components/StravaReveal.tsx',{
      react:{useState:init=>{const i=cursor++; if (!(i in states)) states[i]=init; return [states[i],v=>states[i]=typeof v==='function'?v(states[i]):v];},useEffect:fn=>{effect??=fn;},useMemo:fn=>fn()},
      'react/jsx-runtime':{jsx:element,jsxs:element},
      'framer-motion':{motion:{div:'div'},AnimatePresence:'AnimatePresence'},
    },{fetch:async()=>failure?Response.json({error:'read failure'},{status:500}):Response.json({enduranceActivityCount:0,highlights:{},athlete:{activeWeeks:0,consistency:null},language:{}})});
    const render=()=>{cursor=0;return mod.default({onContinue(){}});};
    assert.match(JSON.stringify(render()),/Reading your training history/); effect(); await new Promise(r=>setImmediate(r));
    assert.match(JSON.stringify(render()),failure?/Retry highlights/:/Your history import completed/);
    assert.doesNotMatch(JSON.stringify(render()),/0 endurance activities analyzed|0% consistency/);
  }
});
