import type { TrainingPause } from '@/utils/trainingPause';
import { NextResponse } from 'next/server';
import { AuthError, createRouteSupabaseClient, requireUser } from '@/lib/supabase/server';
import { getWeeklySummary } from '@/utils/getWeeklySummary';
import { getWeeklyVolume } from '@/utils/getWeeklyVolume';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createRouteSupabaseClient();
    const user = await requireUser(supabase);

    const [{ data: sessions }, { data: completed }, { data: strava }, { data: pauses, error: pauseError }] = await Promise.all([
      supabase.from('sessions').select('*').eq('user_id', user.id),
      supabase.from('completed_sessions').select('*').eq('user_id', user.id),
      supabase.from('strava_activities').select('*').eq('user_id', user.id),
      supabase.from('training_pauses').select('*').eq('user_id', user.id),
    ]);

    if (pauseError) throw pauseError;
    const summary = getWeeklySummary(sessions || [], completed || [], strava || [], (pauses ?? []) as TrainingPause[]);
    const volume = getWeeklyVolume(sessions || [], completed || [], strava || []);

    return NextResponse.json({ ...summary, weeklyVolume: volume });
  } catch (error) {
    console.error('[weekly-summary] failed:', error);

    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: 'Failed to load weekly summary.' }, { status: 500 });
  }
}
