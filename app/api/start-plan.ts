import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getNextMonday } from '@/utils/getNextMonday'; // you'll define this
import { differenceInCalendarWeeks } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json();
  const supabase = createServerComponentClient({ cookies });

  const {
    raceType,
    raceDate,
    experience,
    maxHours,
    restDay,
    bikeFTP,
    runPace,
    swimPace,
    userNote,
  } = body;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startDate = getNextMonday(new Date());
  const parsedRaceDate = new Date(raceDate);
  const totalWeeks = differenceInCalendarWeeks(parsedRaceDate, startDate) + 1;

  const { data, error } = await supabase
    .from('plans')
    .insert({
      user_id: user.id,
      race_type: raceType,
      race_date: parsedRaceDate,
      experience,
      max_hours: maxHours,
      rest_day: restDay,
      note: userNote,
      status: 'pending',
      total_weeks: totalWeeks,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('❌ Failed to insert plan:', error);
    return NextResponse.json({ error: 'Failed to start plan' }, { status: 500 });
  }

  return NextResponse.json({
    planId: data.id,
    totalWeeks,
    startDate: startDate.toISOString(),
  });
}
