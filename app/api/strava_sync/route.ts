import { NextResponse } from 'next/server';
import {
  AuthError,
  createRouteSupabaseClient,
  requireUser,
} from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ProfileRow = {
  strava_access_token: string | null;
  strava_refresh_token: string | null;
  strava_expires_at: number | null;
};

type StravaSummaryActivity = {
  id: number;
  name?: string;
  sport_type?: string;
  type?: string;
  start_date?: string;
};

type ExistingActivityRow = {
  strava_id: number;
};

function normalizeSportType(input: string | null | undefined): string {
  switch (input?.toLowerCase()) {
    case 'ride':
    case 'virtualride':
      return 'Bike';
    case 'run':
      return 'Run';
    case 'swim':
      return 'Swim';
    default:
      return 'Other';
  }
}

function getUnixSecondsFromIso(value: string | null | undefined) {
  if (!value) return null;

  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) return null;

  return Math.floor(timestamp / 1000);
}

async function refreshStravaToken({
  refreshToken,
  userId,
  supabase,
}: {
  refreshToken: string;
  userId: string;
  supabase: Awaited<ReturnType<typeof createRouteSupabaseClient>>;
}) {
  const refreshRes = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  const refreshData = await refreshRes.json();

  if (!refreshRes.ok) {
    console.error('[strava_sync] token refresh failed:', refreshData);
    throw new Error('Token refresh failed');
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      strava_access_token: refreshData.access_token,
      strava_refresh_token: refreshData.refresh_token,
      strava_expires_at: refreshData.expires_at,
    })
    .eq('id', userId);

  if (error) {
    console.error('[strava_sync] failed to save refreshed token:', error);
    throw new Error('Failed to save refreshed Strava token');
  }

  return String(refreshData.access_token);
}

export async function POST() {
  try {
    const supabase = await createRouteSupabaseClient();
    const user = await requireUser(supabase);

    if (!process.env.STRAVA_CLIENT_ID || !process.env.STRAVA_CLIENT_SECRET) {
      return NextResponse.json(
        { error: 'Server misconfigured: missing Strava credentials.' },
        { status: 500 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('strava_access_token, strava_refresh_token, strava_expires_at')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('[strava_sync] profile lookup failed:', profileError);

      return NextResponse.json(
        { error: 'Failed to load Strava profile.' },
        { status: 500 }
      );
    }

    const typedProfile = profile as ProfileRow | null;

    if (!typedProfile?.strava_access_token || !typedProfile?.strava_refresh_token) {
      return NextResponse.json(
        { error: 'Strava not connected.' },
        { status: 400 }
      );
    }

    let accessToken = typedProfile.strava_access_token;

    const now = Math.floor(Date.now() / 1000);
    const expiresAt = Number(typedProfile.strava_expires_at ?? 0);

    if (expiresAt <= now + 60) {
      accessToken = await refreshStravaToken({
        refreshToken: typedProfile.strava_refresh_token,
        userId: user.id,
        supabase,
      });
    }

    const { data: latestActivity } = await supabase
      .from('strava_activities')
      .select('start_date')
      .eq('user_id', user.id)
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const typedLatestActivity = latestActivity as { start_date: string | null } | null;
    const latestStoredUnix = getUnixSecondsFromIso(typedLatestActivity?.start_date);

    // First sync gets 90 days. Later syncs fetch from the latest stored activity,
    // with a one-hour buffer to avoid missing activities around timestamp edges.
    const after =
      latestStoredUnix !== null
        ? Math.max(0, latestStoredUnix - 60 * 60)
        : Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 90;

    const listRes = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=200`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!listRes.ok) {
      const errText = await listRes.text();
      console.error('[strava_sync] activity list failed:', errText);

      return NextResponse.json(
        { error: 'Failed to fetch Strava activities.' },
        { status: 500 }
      );
    }

    const summaryList = (await listRes.json()) as StravaSummaryActivity[];

    if (!Array.isArray(summaryList) || summaryList.length === 0) {
      return NextResponse.json({
        inserted: 0,
        totalFetched: 0,
        skippedExisting: 0,
      });
    }

    const summaryIds = summaryList.map((activity) => activity.id).filter(Boolean);

    const { data: existingRows, error: existingError } = await supabase
      .from('strava_activities')
      .select('strava_id')
      .eq('user_id', user.id)
      .in('strava_id', summaryIds);

    if (existingError) {
      console.error('[strava_sync] existing activity lookup failed:', existingError);

      return NextResponse.json(
        { error: 'Failed to check existing Strava activities.' },
        { status: 500 }
      );
    }

    const existingIds = new Set(
      ((existingRows ?? []) as ExistingActivityRow[]).map((row) => Number(row.strava_id))
    );

    const newSummaries = summaryList.filter((activity) => !existingIds.has(Number(activity.id)));
    const detailedActivities: Record<string, unknown>[] = [];

    for (const summary of newSummaries) {
      const detailRes = await fetch(
        `https://www.strava.com/api/v3/activities/${summary.id}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!detailRes.ok) {
        console.warn(`[strava_sync] failed to fetch activity detail: ${summary.id}`);
        continue;
      }

      const detail = await detailRes.json();

      detailedActivities.push({
        user_id: user.id,
        strava_id: detail.id,
        name: detail.name,
        sport_type: normalizeSportType(detail.sport_type ?? detail.type),
        distance: detail.distance ?? null,
        moving_time: detail.moving_time ?? null,
        start_date: detail.start_date ?? null,
        start_date_local: detail.start_date_local ?? detail.start_date ?? null,
        average_speed: detail.average_speed ?? null,
        average_heartrate: detail.average_heartrate ?? null,
        max_heartrate: detail.max_heartrate ?? null,
        average_watts: detail.average_watts ?? null,
        weighted_average_watts: detail.weighted_average_watts ?? null,
        kilojoules: detail.kilojoules ?? null,
        device_watts: detail.device_watts ?? null,
        trainer: detail.trainer ?? null,
        total_elevation_gain: detail.total_elevation_gain ?? null,
      });

      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    if (detailedActivities.length === 0) {
      return NextResponse.json({
        inserted: 0,
        totalFetched: summaryList.length,
        skippedExisting: summaryList.length,
      });
    }

    const { data: upsertedRows, error: upsertError } = await supabase
      .from('strava_activities')
      .upsert(detailedActivities, {
        onConflict: 'strava_id',
        ignoreDuplicates: true,
      })
      .select('strava_id');

    if (upsertError) {
      console.error('[strava_sync] upsert failed:', upsertError);

      return NextResponse.json(
        { error: upsertError.message },
        { status: 500 }
      );
    }

    const inserted = Array.isArray(upsertedRows) ? upsertedRows.length : 0;

    return NextResponse.json({
      inserted,
      totalFetched: summaryList.length,
      skippedExisting: summaryList.length - inserted,
    });
  } catch (error) {
    console.error('[strava_sync] failed:', error);

    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: 'Failed to sync Strava activities.' },
      { status: 500 }
    );
  }
}
