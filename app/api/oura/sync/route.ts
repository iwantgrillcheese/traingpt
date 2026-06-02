import { NextResponse } from 'next/server';
import { AuthError, createRouteSupabaseClient, requireUser } from '@/lib/supabase/server';
import { dateDaysAgo, fetchOura, getValidOuraConnection, OURA_PROVIDER, pickReadinessScore, ymd } from '@/lib/oura';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type OuraList<T> = { data?: T[]; next_token?: string | null };

type OuraDailyReadiness = {
  id?: string;
  day?: string;
  score?: number | null;
  readiness_score?: number | null;
  contributors?: Record<string, any>;
};

type OuraDailySleep = {
  id?: string;
  day?: string;
  score?: number | null;
  contributors?: Record<string, any>;
};

type OuraDailyActivity = {
  id?: string;
  day?: string;
  score?: number | null;
  active_calories?: number | null;
  steps?: number | null;
  total_calories?: number | null;
};

function byDay<T extends { day?: string }>(items?: T[]) {
  return new Map((items ?? []).filter((item) => item.day).map((item) => [item.day!, item]));
}

export async function POST(req: Request) {
  try {
    const supabase = await createRouteSupabaseClient(req);
    const user = await requireUser(supabase);
    const connection = await getValidOuraConnection(supabase, user.id);

    if (!connection) {
      return NextResponse.json({ error: 'Oura is not connected.' }, { status: 400 });
    }

    const url = new URL(req.url);
    const startDate = url.searchParams.get('start_date') || dateDaysAgo(14);
    const endDate = url.searchParams.get('end_date') || ymd(new Date());
    const query = `start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;

    const [readiness, sleep, activity] = await Promise.all([
      fetchOura<OuraList<OuraDailyReadiness>>(connection, `/v2/usercollection/daily_readiness?${query}`),
      fetchOura<OuraList<OuraDailySleep>>(connection, `/v2/usercollection/daily_sleep?${query}`).catch((error) => {
        console.warn('[oura/sync] daily_sleep unavailable:', error);
        return { data: [] } as OuraList<OuraDailySleep>;
      }),
      fetchOura<OuraList<OuraDailyActivity>>(connection, `/v2/usercollection/daily_activity?${query}`).catch((error) => {
        console.warn('[oura/sync] daily_activity unavailable:', error);
        return { data: [] } as OuraList<OuraDailyActivity>;
      }),
    ]);

    const sleepByDay = byDay(sleep.data);
    const activityByDay = byDay(activity.data);

    const rows = (readiness.data ?? [])
      .filter((day) => day.day)
      .map((day) => {
        const sleepDay = sleepByDay.get(day.day!);
        const activityDay = activityByDay.get(day.day!);
        return {
          user_id: user.id,
          provider: OURA_PROVIDER,
          date: day.day,
          readiness_score: pickReadinessScore(day),
          sleep_score: sleepDay?.score ?? null,
          activity_score: activityDay?.score ?? null,
          hrv: day?.contributors?.hrv_balance ?? day?.contributors?.hrv ?? null,
          resting_hr: day?.contributors?.resting_heart_rate ?? null,
          raw_payload: {
            readiness: day,
            sleep: sleepDay ?? null,
            activity: activityDay ?? null,
          },
          updated_at: new Date().toISOString(),
        };
      });

    if (rows.length) {
      const { error } = await supabase
        .from('daily_recovery_scores')
        .upsert(rows, { onConflict: 'user_id,provider,date' });
      if (error) throw error;
    }

    const { error: updateError } = await supabase
      .from('wearable_connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('provider', OURA_PROVIDER);

    if (updateError) throw updateError;

    return NextResponse.json({ ok: true, synced: rows.length, start_date: startDate, end_date: endDate });
  } catch (error) {
    console.error('[oura/sync] failed:', error);
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Oura sync failed.' }, { status: 500 });
  }
}
