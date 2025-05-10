import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { isSameDay, parseISO, startOfDay } from 'date-fns';

export const dynamic = 'force-dynamic';


export async function POST() {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: planData } = await supabase
    .from('plans')
    .select('id, plan')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const { data: activities } = await supabase
    .from('strava_activities')
    .select('sport_type, moving_time, start_date_local')
    .eq('user_id', user.id);

  if (!planData || !activities) return NextResponse.json({ error: 'Missing data' }, { status: 400 });


  const completedRows = [];
  const planId = planData.id;
  const typeMap: Record<string, string> = {
    swim: 'swim',
    run: 'run',
    ride: 'bike',
    virtualride: 'bike',
  };

  for (const week of planData.plan) {
    for (const [date, sessions] of Object.entries(week.days as Record<string, string[]>)) {
      const parsedDate = parseISO(date);
      const dayActivities = activities.filter((a) => isSameDay(parsedDate, parseISO(a.start_date_local)));

      for (const sessionTitle of sessions) {
        const normalized = sessionTitle.toLowerCase();
        const matchType = Object.values(typeMap).find((t) => normalized.includes(t));

        if (!matchType) continue;
        const matched = dayActivities.find((a) => typeMap[a.sport_type?.toLowerCase()] === matchType);

        completedRows.push({
          user_id: user.id,
          plan_id: planId,
          date,
          sport: sessionTitle,
          status: matched ? 'done' : 'missed',
        });
      }
    }
  }

  const { error } = await supabase.from('completed_sessions').upsert(completedRows, {
    onConflict: 'user_id,date,sport',
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ status: 'ok', updated: completedRows.length });
}
