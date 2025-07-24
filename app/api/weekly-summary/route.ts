// /app/api/weekly-summary/route.ts
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import { getWeeklySummary } from '@/utils/getWeeklySummary';
import { getWeeklyVolume } from '@/utils/getWeeklyVolume';

export async function GET() {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const [{ data: sessions }, { data: completed }, { data: strava }] = await Promise.all([
    supabase.from('sessions').select('*').eq('user_id', user.id),
    supabase.from('completed_sessions').select('*').eq('user_id', user.id),
    supabase.from('strava_activities').select('*').eq('user_id', user.id),
  ]);

  const summary = getWeeklySummary(sessions || [], completed || [], strava || []);
  const volume = getWeeklyVolume(sessions || [], completed || [], strava || []);

  return NextResponse.json({ ...summary, weeklyVolume: volume });
}
