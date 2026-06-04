import { NextResponse } from 'next/server';
import { AuthError, createRouteSupabaseClient, requireUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INITIAL_LOOKBACK_DAYS = 90;
const PARTIAL_SYNC_THRESHOLD = 10;
const MAX_STRAVA_PAGES = 3;

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
function getUnixSecondsFromIso(value: string | null | undefined) { if (!value) return null; const timestamp = new Date(value).getTime(); if (!Number.isFinite(timestamp)) return null; return Math.floor(timestamp / 1000); }
function lookbackUnix(days: number) { return Math.floor(Date.now() / 1000) - 60 * 60 * 24 * days; }

async function refreshStravaToken({ refreshToken, userId, supabase }: { refreshToken: string; userId: string; supabase: Awaited<ReturnType<typeof createRouteSupabaseClient>>; }) {
  const refreshRes = await fetch('https://www.strava.com/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: process.env.STRAVA_CLIENT_ID, client_secret: process.env.STRAVA_CLIENT_SECRET, grant_type: 'refresh_token', refresh_token: refreshToken }) });
  const refreshData = await refreshRes.json();
  if (!refreshRes.ok) { console.error('[strava_sync] token refresh failed:', refreshData); throw new Error('Token refresh failed'); }
  const { error } = await supabase.from('profiles').update({ strava_access_token: refreshData.access_token, strava_refresh_token: refreshData.refresh_token, strava_expires_at: refreshData.expires_at }).eq('id', userId);
  if (error) { console.error('[strava_sync] failed to save refreshed token:', error); throw new Error('Failed to save refreshed Strava token'); }
  return String(refreshData.access_token);
}

async function fetchStravaActivities({ accessToken, after }: { accessToken: string; after: number }) {
  const summaryList: StravaSummaryActivity[] = [];
  for (let page = 1; page <= MAX_STRAVA_PAGES; page += 1) {
    const listRes = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=200&page=${page}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!listRes.ok) { const errText = await listRes.text(); console.error('[strava_sync] activity list failed:', errText); throw new Error('Failed to fetch Strava activities.'); }
    const pageActivities = (await listRes.json()) as StravaSummaryActivity[];
    if (!Array.isArray(pageActivities) || pageActivities.length === 0) break;
    summaryList.push(...pageActivities);
    if (pageActivities.length < 200) break;
  }
  return summaryList;
}

export async function POST(req: Request) {
  try {
    const supabase = await createRouteSupabaseClient(req);
    const user = await requireUser(supabase);
    const body = await req.json().catch(() => ({}));
    const forceBackfill = Boolean(body?.forceBackfill);
    if (!process.env.STRAVA_CLIENT_ID || !process.env.STRAVA_CLIENT_SECRET) return NextResponse.json({ error: 'Server misconfigured: missing Strava credentials.' }, { status: 500 });

    const { data: profile, error: profileError } = await supabase.from('profiles').select('strava_access_token, strava_refresh_token, strava_expires_at').eq('id', user.id).maybeSingle();
    if (profileError) { console.error('[strava_sync] profile lookup failed:', profileError); return NextResponse.json({ error: 'Failed to load Strava profile.' }, { status: 500 }); }
    const typedProfile = profile as ProfileRow | null;
    if (!typedProfile?.strava_access_token || !typedProfile?.strava_refresh_token) return NextResponse.json({ error: 'Strava not connected.' }, { status: 400 });

    let accessToken = typedProfile.strava_access_token;
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = Number(typedProfile.strava_expires_at ?? 0);
    if (expiresAt <= now + 60) accessToken = await refreshStravaToken({ refreshToken: typedProfile.strava_refresh_token, userId: user.id, supabase });

    const [{ data: latestActivity }, { count: storedActivityCount }] = await Promise.all([
      supabase.from('strava_activities').select('start_date').eq('user_id', user.id).order('start_date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('strava_activities').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    ]);
    const typedLatestActivity = latestActivity as { start_date: string | null } | null;
    const latestStoredUnix = getUnixSecondsFromIso(typedLatestActivity?.start_date);
    const currentStoredCount = storedActivityCount ?? 0;
    const shouldBackfillHistory = forceBackfill || currentStoredCount < PARTIAL_SYNC_THRESHOLD || latestStoredUnix === null;
    const after = shouldBackfillHistory ? lookbackUnix(INITIAL_LOOKBACK_DAYS) : Math.max(0, latestStoredUnix - 60 * 60);
    const summaryList = await fetchStravaActivities({ accessToken, after });

    if (summaryList.length === 0) return NextResponse.json({ inserted: 0, totalFetched: 0, skippedExisting: 0, mode: shouldBackfillHistory ? 'backfill' : 'incremental' });
    const summaryIds = summaryList.map((activity) => activity.id).filter(Boolean);
    const { data: existingRows, error: existingError } = await supabase.from('strava_activities').select('strava_id').eq('user_id', user.id).in('strava_id', summaryIds);
    if (existingError) { console.error('[strava_sync] existing activity lookup failed:', existingError); return NextResponse.json({ error: 'Failed to check existing Strava activities.' }, { status: 500 }); }
    const existingIds = new Set(((existingRows ?? []) as ExistingActivityRow[]).map((row) => Number(row.strava_id)));
    const newSummaries = summaryList.filter((activity) => !existingIds.has(Number(activity.id)));
    const rowsToUpsert = newSummaries.map((activity) => ({ user_id: user.id, strava_id: activity.id, name: activity.name ?? 'Strava activity', sport_type: normalizeSportType(activity.sport_type ?? activity.type), distance: activity.distance ?? null, moving_time: activity.moving_time ?? null, start_date: activity.start_date ?? null, start_date_local: activity.start_date_local ?? activity.start_date ?? null, average_speed: activity.average_speed ?? null, average_heartrate: activity.average_heartrate ?? null, max_heartrate: activity.max_heartrate ?? null, average_watts: activity.average_watts ?? null, weighted_average_watts: activity.weighted_average_watts ?? null, kilojoules: activity.kilojoules ?? null, device_watts: activity.device_watts ?? null, trainer: activity.trainer ?? null, total_elevation_gain: activity.total_elevation_gain ?? null }));
    if (rowsToUpsert.length === 0) return NextResponse.json({ inserted: 0, totalFetched: summaryList.length, skippedExisting: summaryList.length, mode: shouldBackfillHistory ? 'backfill' : 'incremental' });

    const { data: upsertedRows, error: upsertError } = await supabase.from('strava_activities').upsert(rowsToUpsert, { onConflict: 'strava_id', ignoreDuplicates: true }).select('strava_id');
    if (upsertError) { console.error('[strava_sync] upsert failed:', upsertError); return NextResponse.json({ error: upsertError.message }, { status: 500 }); }
    const inserted = Array.isArray(upsertedRows) ? upsertedRows.length : 0;
    return NextResponse.json({ inserted, totalFetched: summaryList.length, skippedExisting: summaryList.length - inserted, mode: shouldBackfillHistory ? 'backfill' : 'incremental' });
  } catch (error) {
    console.error('[strava_sync] failed:', error);
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to sync Strava activities.' }, { status: 500 });
  }
}
