import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { load } from './helpers/load-ts.mjs';
const attribution = await load('lib/analytics/attribution.ts');
const at = new Date('2026-10-02T00:00:00Z');
const tagged = 'https://traingpt.co/?utm_source=reddit&utm_medium=social&utm_campaign=launch&utm_content=post&utm_term=triathlon&code=secret&access_token=secret#token';

test('first touch allowlists campaign metadata and removes secrets/referrer paths', () => {
  const touch = attribution.captureTouch(tagged, 'https://www.reddit.com/r/running?token=secret', at);
  assert.equal(touch.utm_source, 'reddit');
  assert.equal(touch.utm_medium, 'social'); assert.equal(touch.utm_campaign, 'launch');
  assert.equal(touch.utm_content, 'post'); assert.equal(touch.utm_term, 'triathlon');
  assert.equal(touch.external_referrer, 'https://www.reddit.com/');
  assert.equal(touch.landing_path, '/'); assert.equal(touch.captured_at, at.toISOString());
  assert.ok(!JSON.stringify(touch).includes('secret'));
  assert.equal(attribution.sourceOf(touch), 'utm:reddit');
});

test('Google OAuth, own domains and callbacks never establish an acquisition source', () => {
  for (const referrer of ['https://accounts.google.com/', 'https://www.traingpt.co/', 'https://traingpt-preview.vercel.app/', 'https://qvfwlljzlskhpvjqsntt.supabase.co/auth/v1/']) {
    const touch = attribution.captureTouch('https://traingpt.co/plan', referrer, at);
    assert.equal(touch.referring_domain, null);
    assert.equal(attribution.sourceOf(touch), 'unknown/direct');
  }
  for (const path of ['/auth/callback?code=secret', '/api/strava/callback?code=secret','/login','/schedule']) assert.equal(attribution.captureTouch('https://traingpt.co' + path, '', at), null);
  assert.equal(attribution.sourceOf(attribution.captureTouch('https://traingpt.co/?utm_source=accounts.google.com', '', at)), 'unknown/direct');
  assert.equal(attribution.sourceOf(attribution.captureTouch('https://traingpt.co/', 'https://www.google.com/search?q=triathlon', at)), 'referrer:www.google.com');
});

test('server rejects after-signup, expired, malformed and preview touches', () => {
  const touch = attribution.captureTouch(tagged, '', at);
  assert.ok(attribution.validateTouch(touch, '2026-10-02T00:01:00Z'));
  assert.equal(attribution.validateTouch(touch, '2026-10-01T00:00:00Z'), null);
  assert.equal(attribution.validateTouch(touch, '2027-10-02T00:00:00Z'), null);
  assert.equal(attribution.validateTouch({ ...touch, landing_url: 'https://preview.vercel.app/?utm_source=test' }, '2026-10-02T00:01:00Z'), null);
  assert.equal(attribution.validateTouch({ ...touch, captured_at: 'bad' }, at.toISOString()), null);
  assert.equal(attribution.analyticsEnvironment('traingpt.co', 'preview'), 'test');
  assert.equal(attribution.analyticsEnvironment('preview.vercel.app', 'production'), 'test');
});

async function browserModule() {
  const storage = new Map(); const jar = new Map(); const captures = []; const identifies = [];
  let optedOut = false, sdkConfig, currentId = 'anonymous-before-google', resetCount = 0;
  const window = { localStorage: { getItem: key => storage.get(key) || null, setItem: (key,value) => storage.set(key,value), removeItem: key => storage.delete(key) }, location: new URL(tagged) };
  const document = { referrer: 'https://www.reddit.com/r/running' };
  Object.defineProperty(document, 'cookie', { get: () => [...jar.entries()].map(([k,v])=>`${k}=${v}`).join('; '), set: raw => { const [pair] = raw.split(';'); const index=pair.indexOf('='); const key=pair.slice(0,index); if(raw.includes('Max-Age=0')) jar.delete(key); else jar.set(key,pair.slice(index+1)); } });
  const sdk = {
    init: (_key, config) => { sdkConfig = config; }, has_opted_out_capturing: () => optedOut,
    identify: id => { identifies.push([currentId,id]); currentId = id; },
    capture: (event, properties) => { const captured = sdkConfig.before_send({event, properties}); captures.push({id:currentId, ...captured}); return captured; },
    reset: () => { resetCount++; currentId='anonymous-after-logout'; }, register: () => {}, setPersonProperties: () => {},
  };
  const context = vm.createContext({ window, document, URL, Date, console, process: { env: { NEXT_PUBLIC_POSTHOG_KEY:'test', NEXT_PUBLIC_VERCEL_ENV:'production' } } });
  const cache = new Map();
  async function resolve(path) {
    if (cache.has(path)) return cache.get(path);
    if(path==='posthog-js') { const mod = new vm.SyntheticModule(['default'],function(){this.setExport('default',sdk)}, {context}); cache.set(path,mod); return mod; }
    const file = path==='./attribution' ? 'lib/analytics/attribution.ts' : path;
    const source = ts.transpileModule(await readFile(new URL('../'+file,import.meta.url),'utf8'), {compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
    const mod=new vm.SourceTextModule(source,{context}); cache.set(path,mod); return mod;
  }
  const mod=await resolve('lib/analytics/posthog-client.ts'); await mod.link(resolve); await mod.evaluate();
  const utils=await resolve('./attribution');
  return {client:mod.namespace, utils:utils.namespace, window, captures, identifies, jar, setConsent:value=>{optedOut=!value}, get resetCount(){return resetCount}};
}

test('tagged landing → Google callback → identify links original anonymous history; returning login stays stable', async () => {
  const browser=await browserModule();
  browser.client.initPostHog(); browser.client.track('landing_viewed');
  const original=browser.utils.readTouch();
  browser.window.location=new URL('https://traingpt.co/auth/callback?code=secret');
  browser.client.initPostHog(); browser.client.captureFirstTouch();
  browser.window.location=new URL('https://traingpt.co/plan');
  browser.client.identify({id:'new-account'});
  assert.deepEqual(browser.identifies, [['anonymous-before-google','new-account']]);
  assert.equal(browser.captures[0].id, 'anonymous-before-google');
  assert.equal(browser.utils.readTouch().landing_url, original.landing_url);
  browser.client.setAccountAttribution(original, 'utm:reddit');
  browser.window.location=new URL('https://traingpt.co/?utm_source=instagram');
  browser.client.captureFirstTouch(); browser.client.track('schedule_viewed');
  assert.equal(browser.captures.at(-1).properties.measured_source, 'utm:reddit');
  assert.equal(browser.utils.readTouch().utm_source,'reddit'); assert.equal(browser.resetCount,0);
  browser.client.reset(); assert.equal(browser.utils.readTouch(), null); assert.equal(browser.resetCount,1);
});

test('www and non-www share first-touch cookie; SDK configuration supports shared anonymous identity', async () => {
  const browser=await browserModule(); browser.window.location=new URL(tagged.replace('://traingpt','://www.traingpt'));
  browser.client.initPostHog();
  browser.window.location=new URL('https://traingpt.co/plan');
  assert.equal(browser.utils.readTouch().utm_source,'reddit');
  browser.client.track('page_viewed',{$current_url:'https://traingpt.co/auth/callback?code=secret', $referrer:'https://accounts.google.com/o/oauth?token=secret'});
  assert.ok(!JSON.stringify(browser.captures.at(-1)).includes('secret'));
  assert.equal(browser.captures.at(-1).properties.$referrer,'$direct');
});

test('consent opt-out prevents capture and attribution persistence', async () => {
  const browser=await browserModule(); browser.setConsent(false); browser.client.initPostHog();
  assert.equal(browser.utils.readTouch(),null); browser.client.track('landing_viewed'); assert.equal(browser.captures.length,0);
  browser.setConsent(true); browser.client.captureFirstTouch(); assert.ok(browser.utils.readTouch());
  browser.setConsent(false); browser.client.captureFirstTouch(); assert.equal(browser.utils.readTouch(),null);
});

// Server integration: execute the real association logic against a Supabase-like
// store, including atomic conditional updates, and assert response/consent rules.
function storeClient() {
  const tables = { acquisition_config:[{id:true,started_at:'2026-10-01T00:00:00Z'}],account_acquisition:[], acquisition_saved_plans:[],profiles:[] };
  return { tables, from(table) {
    let operation='select', payload, filter=[];
    const builder = {
      select: () => builder, eq:(key,value)=>{filter.push(row=>row[key]===value);return builder},
      is:(key,value)=>{filter.push(row=>(row[key]??null)===value);return builder},
      upsert:value=>{operation='upsert';payload=value;return builder},
      insert:value=>{operation='insert';payload=value;return builder},
      update:value=>{operation='update';payload=value;return builder},
      single:async()=>{const result=run();return {...result,data:result.data[0]??null}},
      then:(resolve,reject)=>Promise.resolve(run()).then(resolve,reject),
    };
    function run() {
      let rows = tables[table].filter(row=>filter.every(fn=>fn(row)));
      if(operation==='upsert') {
        if(!tables[table].some(row=>row.user_id===payload.user_id)) tables[table].push({...payload});
      } else if(operation==='insert') tables[table].push({...payload});
      else if(operation==='update') rows.forEach(row=>Object.assign(row,payload));
      return {data:rows.map(row=>({...row})),error:null};
    }
    return builder;
  }};
}

test('actual association persists once, emits signup once across logins and rejects historical backfill', async () => {
  const db=storeClient();
  const server=await load('lib/analytics/acquisition-server.ts',{'@supabase/supabase-js':{createClient:()=>db}},{NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test',VERCEL_ENV:'production'});
  const user={id:'new-account',created_at:'2026-10-02T00:01:00Z'};
  const request=new Request('https://traingpt.co/api/acquisition');
  const touch=attribution.captureTouch(tagged,'https://reddit.com/',at);
  const first=await server.associateAccount(user,request,touch,true);
  assert.equal(first.source,'utm:reddit'); assert.equal(first.emit_signup,true);
  const returning=await server.associateAccount(user,request,attribution.captureTouch('https://traingpt.co/?utm_source=instagram','',at),true);
  assert.equal(returning.source,'utm:reddit'); assert.equal(returning.emit_signup,false);
  assert.equal(db.tables.account_acquisition.length,1);
  const old=await server.associateAccount({id:'old',created_at:'2026-09-20T00:00:00Z'},request,touch,true);
  assert.equal(old.source,'unknown/direct'); assert.equal(old.emit_signup,false);
  const preview=await server.associateAccount({id:'preview',created_at:user.created_at},new Request('https://preview.vercel.app/api/acquisition'),touch,true);
  assert.equal(preview.source,'unknown/direct'); assert.equal(preview.emit_signup,false);
  assert.equal(db.tables.account_acquisition.find(row=>row.user_id==='preview').environment,'test');
  const refused=await server.associateAccount({id:'consent-off',created_at:user.created_at},request,touch,false);
  assert.equal(refused.first_touch,null); assert.equal(refused.emit_signup,false);
});

test('valid saved-plan ledger records success and first-plan eligibility without reopening on replacements', async () => {
  const db=storeClient(); db.tables.profiles.push({id:'athlete',first_plan_saved_at:null});
  const server=await load('lib/analytics/acquisition-server.ts',{'@supabase/supabase-js':{createClient:()=>db}},{NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test',VERCEL_ENV:'production'});
  const request=new Request('https://traingpt.co/api/finalize-plan');
  await server.recordSavedPlan({id:'athlete'},request,'plan',15,false);
  assert.equal(db.tables.profiles[0].discovery_eligible,true);
  const firstAt=db.tables.profiles[0].first_plan_saved_at;
  await server.recordSavedPlan({id:'athlete'},request,'plan',20,true);
  assert.equal(db.tables.profiles[0].first_plan_saved_at,firstAt); assert.equal(db.tables.profiles[0].discovery_eligible,true);
  assert.equal(db.tables.acquisition_saved_plans.length,2);
  await server.recordSavedPlan({id:'athlete'},new Request('https://preview.vercel.app/api/finalize-plan'),'test-plan',20,false);
  assert.equal(db.tables.acquisition_saved_plans.length,2);
});

test('real OAuth callback exchanges code and redirects safely without emitting signup', async () => {
  const exchanged=[];
  const callback=await load('app/auth/callback/route.ts',{
    'next/server':{NextResponse:{redirect:url=>Response.redirect(url,307)}},
    '@/lib/supabase/server':{createRouteSupabaseClient:async()=>({auth:{exchangeCodeForSession:async code=>{exchanged.push(code);return {error:null}}}})},
  });
  const response=await callback.GET(new Request('https://traingpt.co/auth/callback?code=oauth-secret&next=%2Fplan'));
  assert.equal(response.headers.get('location'),'https://traingpt.co/plan'); assert.deepEqual(exchanged,['oauth-secret']);
  for (const next of ['//attacker.example','/\\attacker.example']) {
    const safe=await callback.GET(new Request('https://traingpt.co/auth/callback?code=secret&next='+encodeURIComponent(next)));
    assert.equal(safe.headers.get('location'),'https://traingpt.co/plan');
  }
});

test('real www middleware redirects before auth/analytics and preserves tagged query; in-flight PKCE callback keeps original host', async () => {
  let refreshes=0;
  const middleware=await load('middleware.ts',{
    'next/server':{NextResponse:{redirect:(url,status)=>Response.redirect(url,status)}},
    '@/lib/supabase/middleware':{updateSupabaseSession:async()=>{refreshes++;return new Response('session refreshed')}},
  });
  const url=new URL(tagged.replace('://traingpt','://www.traingpt'));
  url.clone=()=>new URL(url);
  const redirected=await middleware.middleware({nextUrl:url});
  assert.equal(redirected.status,308); assert.equal(redirected.headers.get('location'),tagged);
  assert.equal(refreshes,0);
  const callback=new URL('https://www.traingpt.co/auth/callback?code=secret'); callback.clone=()=>new URL(callback);
  await middleware.middleware({nextUrl:callback}); assert.equal(refreshes,1);
});

test('discovery is saved once; skip needs no analytics consent and preview responses never emit production events', async () => {
  const db=storeClient();
  db.tables.profiles.push({id:'athlete',discovery_eligible:true,discovery_answered_at:null,discovery_skipped_at:null});
  const route=await load('app/api/acquisition/route.ts',{
    'next/server':{NextResponse:{json:Response.json}},
    '@/lib/supabase/server':{AuthError:class extends Error{},requireUser:async()=>({id:'athlete'}),createRouteSupabaseClient:async()=>({})},
    '@/lib/analytics/acquisition-server':{acquisitionAdmin:()=>db,associateAccount:async()=>({}),requestEnvironment:req=>req.url.includes('preview')?'test':'production'},
  });
  const request=body=>new Request('https://traingpt.co/api/acquisition',{method:'POST',headers:{origin:'https://traingpt.co'},body:JSON.stringify(body)});
  const first=await route.POST(request({action:'discovery',source:'reddit',detail:'r/running',analytics_consent:true}));
  assert.equal((await first.json()).emit_event,true);
  const duplicate=await route.POST(request({action:'discovery',source:'other',analytics_consent:true}));
  assert.equal((await duplicate.json()).emit_event,false); assert.equal(db.tables.profiles[0].discovery_source,'reddit');
  db.tables.profiles[0].discovery_answered_at=null;
  const skipped=await route.POST(request({action:'skip_discovery'})); assert.equal((await skipped.json()).saved,true);
  assert.ok(db.tables.profiles[0].discovery_skipped_at);
  assert.equal((await route.POST(new Request('https://traingpt.co/api/acquisition',{method:'POST',headers:{origin:'https://attacker.example'},body:'{}'}))).status,403);
});

test('canonical redirect preserves existing www Supabase sessions rather than dropping host-scoped auth cookies', async () => {
  let refreshed=false;
  const middleware=await load('middleware.ts',{
    'next/server':{NextResponse:{redirect:(url,status)=>Response.redirect(url,status)}},
    '@/lib/supabase/middleware':{updateSupabaseSession:async()=>{refreshed=true;return new Response('existing session retained')}},
  });
  const url=new URL('https://www.traingpt.co/schedule'); url.clone=()=>new URL(url);
  const response=await middleware.middleware({nextUrl:url,cookies:{getAll:()=>[{name:'sb-project-auth-token.0',value:'redacted'}]}});
  assert.equal(response.status,200); assert.equal(refreshed,true);
});
