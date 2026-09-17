import { NextResponse } from 'next/server';
import { AuthError, createRouteSupabaseClient, requireUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Activity = { strava_id: number | null; name: string | null; sport_type: string | null; distance: number | null; moving_time: number | null; start_date: string | null; start_date_local: string | null; total_elevation_gain: number | null; };

const sport = (row: Activity) => String(row.sport_type ?? '').toLowerCase();
const valid = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n > 0;
const maxBy = (rows: Activity[], value: (row: Activity) => number) => rows.reduce<Activity | null>((best, row) => !best || value(row) > value(best) ? row : best, null);
const isoWeekMonday = (dateString: string) => { const d = new Date(dateString); const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day); d.setUTCHours(0, 0, 0, 0); return d.toISOString().slice(0, 10); };

export async function GET(req: Request) {
  try {
    const supabase = await createRouteSupabaseClient(req);
    const user = await requireUser(supabase);
    const [{ data, error }, { data: profile }] = await Promise.all([
      supabase.from('strava_activities').select('strava_id,name,sport_type,distance,moving_time,start_date,start_date_local,total_elevation_gain').eq('user_id', user.id).order('start_date', { ascending: true }).limit(10000),
      supabase.from('profiles').select('strava_last_synced_at').eq('id', user.id).maybeSingle(),
    ]);
    if (error) throw error;
    const rows = (data ?? []) as Activity[];
    const endurance = rows.filter((r) => ['bike', 'run', 'swim'].includes(sport(r)));
    const bikes = endurance.filter((r) => sport(r) === 'bike' && valid(r.distance));
    const runs = endurance.filter((r) => sport(r) === 'run' && valid(r.distance));
    const swims = endurance.filter((r) => sport(r) === 'swim' && valid(r.distance));
    const climbing = endurance.filter((r) => valid(r.total_elevation_gain));
    const longestRide = maxBy(bikes, r => Number(r.distance ?? 0));
    const longestRun = maxBy(runs, r => Number(r.distance ?? 0));
    const longestSwim = maxBy(swims, r => Number(r.distance ?? 0));
    const biggestClimb = maxBy(climbing, r => Number(r.total_elevation_gain ?? 0));

    const weeks = new Map<string, { seconds: number; count: number }>();
    endurance.forEach((r) => { if (!r.start_date) return; const key = isoWeekMonday(r.start_date); const current = weeks.get(key) ?? { seconds: 0, count: 0 }; current.seconds += Number(r.moving_time ?? 0); current.count += 1; weeks.set(key, current); });
    const biggestWeek = [...weeks.entries()].sort((a, b) => b[1].seconds - a[1].seconds)[0] ?? null;
    const activeWeeks = [...weeks.values()].filter(w => w.count > 0).length;
    const first = endurance[0]?.start_date ?? null;
    const last = endurance[endurance.length - 1]?.start_date ?? null;
    const spanWeeks = first && last ? Math.max(1, Math.ceil((new Date(last).getTime() - new Date(first).getTime()) / 604800000) + 1) : 0;
    const hoursBySport = { bike: 0, run: 0, swim: 0 };
    endurance.forEach(r => { const key = sport(r) as keyof typeof hoursBySport; hoursBySport[key] += Number(r.moving_time ?? 0) / 3600; });
    const strongest = (Object.entries(hoursBySport) as Array<[keyof typeof hoursBySport, number]>).sort((a,b) => b[1]-a[1])[0];

    return NextResponse.json({
      activityCount: rows.length,
      enduranceActivityCount: endurance.length,
      firstActivityAt: first,
      latestActivityAt: last,
      lastSyncedAt: (profile as any)?.strava_last_synced_at ?? null,
      highlights: { longestRide, longestRun, longestSwim, biggestClimb, biggestWeek: biggestWeek ? { startDate: biggestWeek[0], movingTime: biggestWeek[1].seconds, activityCount: biggestWeek[1].count } : null },
      athlete: { hoursBySport, strongestDiscipline: strongest?.[1] > 0 ? strongest[0] : null, activeWeeks, spanWeeks, consistency: spanWeeks ? activeWeeks / spanWeeks : null },
      language: { historyQualifier: rows.length >= 10000 ? 'in your imported history (10,000 activity display cap)' : 'in your imported Strava history' },
    });
  } catch (error) {
    console.error('[strava/reveal] failed', error);
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Could not build your Strava reveal.' }, { status: 500 });
  }
}
