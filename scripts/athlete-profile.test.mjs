import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
async function load(path, mocks = {}, globals = {}) {
  const context = vm.createContext({ Request, Response, URL, AbortSignal, console, process: { env: {} }, ...globals });
  const source = stripTypeScriptTypes(await readFile(new URL(path, import.meta.url), 'utf8'));
  const module = new vm.SourceTextModule(source, { context });
  await module.link(spec => new vm.SyntheticModule(Object.keys(mocks[spec]), function() { for (const [key,value] of Object.entries(mocks[spec])) this.setExport(key,value); }, {context}));
  await module.evaluate(); return module.namespace;
}
const {buildBrickProfile} = await load('../lib/strava/athlete-profile.ts');
const {routeGeometry} = await load('../lib/strava/route-geometry.ts');
const now = Date.parse('2026-09-30T12:00:00Z');
const row = (days, sport='Ride', hours=1) => ({start_date: new Date(now-days*86400000).toISOString(), sport_type:sport, moving_time:hours*3600});
const weekly = sport => Array.from({length:8},(_,week)=>[row(week*7+1,sport),row(week*7+3,sport)]).flat();
test('sparse, stale, future and invalid training cannot manufacture a profile',()=>{
  for (const rows of [[],[row(1)],weekly('Run').map(r=>({...r,start_date:'2025-01-01'})),[row(-2),row(1,'Run',Infinity),row(1,'Run',-1)]]) assert.equal(buildBrickProfile(rows,now).id,'builder');
});
test('bike/run and balanced profiles follow evidence rather than lifetime totals',()=>{
  assert.equal(buildBrickProfile(weekly('VirtualRide'),now).id,'diesel');
  assert.equal(buildBrickProfile(weekly('TrailRun'),now).id,'engine');
  const balanced=Array.from({length:8},(_,w)=>[row(w*7+1,'Ride'),row(w*7+2,'Run'),row(w*7+3,'Swim')]).flat();
  assert.equal(buildBrickProfile(balanced,now).id,'allrounder');
  assert.equal(buildBrickProfile([...weekly('Run'),row(300,'Ride',20)],now).id,'engine');
});
test('weekend, long-day and comeback rules have explicit precedence',()=>{
  const weekends = Array.from({length:8},(_,w)=>[row(w*7+3,'Ride'),row(w*7+4,'Run')]).flat();
  assert.equal(buildBrickProfile(weekends,now).id,'weekend');
  assert.equal(buildBrickProfile(weekly('Ride').map(r=>({...r,moving_time:10800})),now).id,'bigday');
  assert.equal(buildBrickProfile(Array.from({length:9},(_,i)=>row(i*2+1,'Run')),now).id,'comeback');
});
test('eight-week shares and evidence are bounded and reproducible',()=>{
  const value=buildBrickProfile(weekly('Run'),now);
  assert.equal(JSON.stringify(value),JSON.stringify(buildBrickProfile(weekly('Run'),now)));
  assert.equal(value.hoursBySport.run,16); assert.ok(value.evidence.includes('8 of 8 weeks active'));
});
test('polyline fits GPS route, rejects malformed and repeated-point data',()=>{
  const route=routeGeometry('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
  assert.ok(route.path.startsWith('M')); assert.ok(!route.path.includes('NaN'));
  for(const point of [route.start,route.end]) assert.ok(point[0]>=40 && point[0]<=560 && point[1]>=30 && point[1]<=250);
  for(const value of ['', '_', '????', 'x'.repeat(100001)]) assert.equal(routeGeometry(value),null);
});
class AuthError extends Error { status=401; }
async function endpoint({owned=true,trainer=false,expired=false,foreign=false,status=200,noGps=false,unauthorized=false}={}) {
  const calls=[]; const writes=[];
  const client={from(table){let filters=[]; const query={select(){return query},eq(k,v){filters.push([k,v]);return query},update(value){writes.push(value);return query},maybeSingle(){return query},then(resolve){
    calls.push({table,filters});
    return Promise.resolve({data:table==='strava_activities' ? owned?{strava_id:123,trainer}:null : {strava_access_token:'secret-token',strava_refresh_token:'refresh',strava_expires_at:expired?0:9999999999,strava_athlete_id:55},error:null}).then(resolve);
  }};return query}};
  const requests=[];
  const mod=await load('../app/api/strava/activity-route/route.ts', {'next/server':{NextResponse:{json:Response.json}},'@/lib/supabase/server':{AuthError,createRouteSupabaseClient:async()=>client,requireUser:async()=>{if(unauthorized)throw new AuthError();return {id:'owner'}}}}, {fetch:async(url)=>{requests.push(url);return url.endsWith('token')?Response.json({access_token:'rotated',refresh_token:'new-refresh',expires_at:9999999999}):Response.json({athlete:{id:foreign?99:55},map:{summary_polyline:noGps?'':'_p~iF~ps|U_ulLnnqC_mqNvxq`@'},device_name:'Garmin'},{status})}});
  return {response:await mod.GET(new Request('https://app/api/strava/activity-route?id=123')),calls,requests,writes};
}
test('route access requires authentication and user-owned activity before Strava fetch',async()=>{
  const unowned=await endpoint({owned:false});assert.equal(unowned.response.status,404);assert.equal(unowned.requests.length,0);
  assert.ok(unowned.calls[0].filters.some(([k,v])=>k==='user_id'&&v==='owner'));
  assert.equal((await endpoint({unauthorized:true})).response.status,401);
  assert.equal((await endpoint({foreign:true})).response.status,404);
});
test('maps refresh tokens server-side and never return credentials',async()=>{
  const result=await endpoint({expired:true});const body=await result.response.text();
  assert.equal(result.response.status,200);assert.equal(result.requests.length,2);assert.equal(result.writes.length,1);
  assert.ok(body.includes('polyline'));assert.ok(!body.includes('token'));assert.equal(result.response.headers.get('cache-control'),'private, no-store');
});
test('indoor, missing GPS and rate limits leave stats available',async()=>{
  const indoor=await endpoint({trainer:true});assert.equal(indoor.requests.length,0);assert.equal((await indoor.response.json()).polyline,null);
  assert.equal((await endpoint({noGps:true})).response.status,200);
  assert.equal((await endpoint({status:429})).response.status,429);
});
