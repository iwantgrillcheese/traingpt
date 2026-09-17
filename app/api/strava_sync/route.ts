import { NextResponse } from 'next/server';
import { AuthError, createRouteSupabaseClient, requireUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const PARTIAL_SYNC_THRESHOLD = 10;
const STRAVA_PAGE_SIZE = 200;
const MAX_HISTORY_PAGES = 50; // 10k activities: effectively complete for the product, with a hard safety cap.
const MAX_INCREMENTAL_PAGES = 5;

type ProfileRow = { strava_access_token: string | null; strava_refresh_token: string | null; strava_expires_at: number | null; };
type StravaSummaryActivity = { id: number; name?: string | null; sport_type?: string | null; type?: string | null; start_date?: string | null; start_date_local?: string | null; distance?: number | null; moving_time?: number | null; average_speed?: number | null; average_heartrate?: number | null; max_heartrate?: number | null; average_watts?: number | null; weighted_average_watts?: number | null; kilojoules?: number | null; device_watts?: boolean | null; trainer?: boolean | null; total_elevation_gain?: number | null; };
type ExistingActivityRow = { strava_id: number; };

function normalizeSportType(input: string | null | undefined): string {
  switch (input?.toLowerCase()) {
    case 'ride': case 'virtualride': case 'ebikeride': case 'mountainbikeride': case 'gravelride': return 'Bike';
    case 'run': case 'trailrun': case 'virtualrun': return 'Run';
    case 'swim': return 'Swim';
    default: return 'Other';
  }
}
function getUnixSecondsFromIso(value: string | null | undefined) { if (!value) return null; const timestamp = new Date(value).getTime(); return Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : null; }

async function refreshStravaToken({ refreshToken, userId, supabase }: { refreshToken: string; userId: string; supabase: Awaited<ReturnType<typeof createRouteSupabaseClient>>; }) {
  const refreshRes = await fetch('https://www.strava.com/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: process.env.STRAVA_CLIENT_ID, client_secret: process.env.STRAVA_CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: refreshToken }) });
  const refreshData = await refreshRes.json();
  if (!refreshRes.ok) { console.error('[strava_sync] token refresh failed:', refreshData); throw new Error('Token refresh failed'); }
  const { error } = await supabase.from('profiles').update({ strava_access_token: refreshData.access_token, strava_refresh_token: refreshData.refresh_token, strava_expires_at: refreshData.expires_at }).eq('id', userId);
  if (error) throw new Error('Failed to save refreshed Strava token');
  return String(refreshData.access_token);
}

async function markSynced({ userId, supabase }: { userId: string; supabase: Awaited<ReturnType<typeof createRouteSupabaseClient>>; }) {
  const syncedAt = new Date().toISOString();
  const { error } = await supabase.from('profiles').update({ strava_last_synced_at: syncedAt }).eq('id', userId);
  if (error) throw new Error('Activities synced, but freshness state could not be saved.');
  return syncedAt;
}

async function fetchStravaActivities({ accessToken, after, fullHistory }: { accessToken: string; after?: number | null; fullHistory: boolean }) {
  const summaryList: StravaSummaryActivity[] = [];
  const maxPages = fullHistory ? MAX_HISTORY_PAGES : MAX_INCREMENTAL_PAGES;
  let exhausted = false;
  for (let page = 1; page <= maxPages; page += 1) {
    const params = new URLSearchParams({ per_page: String(STRAVA_PAGE_SIZE), page: String(page) });
    if (after && after > 0) params.set('after', String(after));
    const listRes = await fetch(`https://www.strava.com/api/v3/athlete/activities?${params.toString()}`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
    if (!listRes.ok) { console.error('[strava_sync] activity list failed:', await listRes.text()); throw new Error('Failed to fetch Strava activities.'); }
    const pageActivities = (await listRes.json()) as StravaSummaryActivity[];
    if (!Array.isArray(pageActivities) || pageActivities.length === 0) { exhausted = true; break; }
    summaryList.push(...pageActivities);
    if (pageActivities.length < STRAVA_PAGE_SIZE) { exhausted = true; break; }
  }
  return { activities: summaryList, completeHistory: fullHistory && exhausted };
}

export async function POST(req: Request) {
  try {
    const supabase = await createRouteSupabaseClient(req);
    const user = await requireUser(supabase);
    const body = await req.json().catch(() => ({}));
    const forceBackfill = Boolean(body?.forceBackfill);
    if (!process.env.STRAVA_CLIENT_ID || !process.env.STRAVA_CLIENT_SECRET) return NextResponse.json({ error: 'Server misconfigured: missing Strava credentials.' }, { status: 500 });

    const { data: profile, error: profileError } = await supabase.from('profiles').select('strava_access_token, strava_refresh_token, strava_expires_at').eq('id', user.id).maybeSingle();
    if (profileError) return NextResponse.json({ error: 'Failed to load Strava profile.' }, { status: 500 });
    const typedProfile = profile as ProfileRow | null;
    if (!typedProfile?.strava_access_token || !typedProfile?.strava_refresh_token) return NextResponse.json({ error: 'Strava not connected.' }, { status: 400 });

    let accessToken = typedProfile.strava_access_token;
    const now = Math.floor(Date.now() / 1000);
    if (Number(typedProfile.strava_expires_at ?? 0) <= now + 60) accessToken = await refreshStravaToken({ refreshToken: typedProfile.strava_refresh_token, userId: user.id, supabase });

    const [{ data: latestActivity }, { count: storedActivityCount }] = await Promise.all([
      supabase.from('strava_activities').select('start_date').eq('user_id', user.id).order('start_date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('strava_activities').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    ]);
    const latestStoredUnix = getUnixSecondsFromIso((latestActivity as { start_date: string | null } | null)?.start_date);
    const currentStoredCount = storedActivityCount ?? 0;
    const fullHistory = forceBackfill || currentStoredCount < PARTIAL_SYNC_THRESHOLD || latestStoredUnix === null;
    const after = fullHistory ? null : Math.max(0, (latestStoredUnix ?? 0) - 3600);
    const fetched = await fetchStravaActivities({ accessToken, after, fullHistory });
    const summaryList = fetched.activities;

    if (summaryList.length) {
      const summaryIds = summaryList.map((activity) => activity.id).filter(Boolean);
      const existingIds = new Set<number>();
      for (let i = 0; i < summaryIds.length; i += 500) {
        const { data, error } = await supabase.from('strava_activities').select('strava_id').eq('user_id', user.id).in('strava_id', summaryIds.slice(i, i + 500));
        if (error) throw new Error('Failed to check existing Strava activities.');
        ((data ?? []) as ExistingActivityRow[]).forEach((row) => existingIds.add(Number(row.strava_id)));
      }
      const newSummaries = summaryList.filter((activity) => !existingIds.has(Number(activity.id)));
      const rows = newSummaries.map((activity) => ({ user_id: user.id, strava_id: activity.id, name: activity.name ?? 'Strava activity', sport_type: normalizeSportType(activity.sport_type ?? activity.type), distance: activity.distance ?? null, moving_time: activity.moving_time ?? null, start_date: activity.start_date ?? null, start_date_local: activity.start_date_local ?? activity.start_date ?? null, average_speed: activity.average_speed ?? null, average_heartrate: activity.average_heartrate ?? null, max_heartrate: activity.max_heartrate ?? null, average_watts: activity.average_watts ?? null, weighted_average_watts: activity.weighted_average_watts ?? null, kilojoules: activity.kilojoules ?? null, device_watts: activity.device_watts ?? null, trainer: activity.trainer ?? null, total_elevation_gain: activity.total_elevation_gain ?? null }));
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await supabase.from('strava_activities').upsert(rows.slice(i, i + 500), { onConflict: 'strava_id', ignoreDuplicates: true });
        if (error) throw new Error(error.message);
      }
    }

    const syncedAt = await markSynced({ userId: user.id, supabase });
    return NextResponse.json({ inserted: summaryList.length, totalFetched: summaryList.length, mode: fullHistory ? 'full_history' : 'incremental', historyComplete: fetched.completeHistory, historyCap: fullHistory && !fetched.completeHistory ? MAX_HISTORY_PAGES * STRAVA_PAGE_SIZE : null, syncedAt });
  } catch (error) {
    console.error('[strava_sync] failed:', error);
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to sync Strava activities.' }, { status: 500 });
  }
}
