import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { startOfWeek, addDays, format, isWithinInterval, parseISO } from 'date-fns';
import { sendUpcomingWeekEmail } from '@/lib/emails/send-upcoming-week-email';

export const runtime = 'nodejs';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const testEmail = req.nextUrl.searchParams.get('test');
  const manual = req.nextUrl.searchParams.get('manual');

  const start = startOfWeek(new Date(), { weekStartsOn: 1 });
  const end = addDays(start, 6);
  const weekRange = `${format(start, 'MMM d')} – ${format(end, 'MMM d')}`;

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email');

  if (profilesError) {
    console.error('❌ Error fetching profiles:', profilesError);
    return NextResponse.json({ success: false, error: profilesError.message }, { status: 500 });
  }

  const filteredProfiles = testEmail
    ? profiles?.filter((p) => p.email === testEmail)
    : profiles;

  for (const user of filteredProfiles || []) {
    if (!user.email) continue;

    console.log(`▶️ Checking user: ${user.email}`);

    const { data: plans, error: planError } = await supabase
      .from('plans')
      .select('id, plan')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (planError) {
      console.error(`❌ Error fetching plans for ${user.email}:`, planError);
      continue;
    }

    const plan = plans?.[0]?.plan;
    if (!plan || !Array.isArray(plan)) {
      console.log(`⛔ No structured plan found for user ${user.email}`);
      continue;
    }

    // Flatten sessions from this week's date range
    const sessionsThisWeek: {
      date: string;
      sport: string;
      title: string;
      duration_minutes?: number;
    }[] = [];

    for (const week of plan) {
      if (!week.days) continue;
      for (const dateStr of Object.keys(week.days)) {
        const date = parseISO(dateStr);
        if (!isWithinInterval(date, { start, end })) continue;

        for (const session of week.days[dateStr]) {
          sessionsThisWeek.push({
            date: dateStr,
            sport: session.includes('🏊') ? 'Swim' :
                   session.includes('🚴') ? 'Bike' :
                   session.includes('🏃') ? 'Run' : 'Other',
            title: session,
          });
        }
      }
    }

    if (!sessionsThisWeek.length) {
      console.log(`⛔ No sessions this week for user ${user.email}`);
      continue;
    }

    console.log(`✅ Sending email to ${user.email} with ${sessionsThisWeek.length} sessions`);

    await sendUpcomingWeekEmail({
      email: user.email,
      sessions: sessionsThisWeek,
      coachNote: `You're entering a key training week. Keep showing up — consistency wins.`,
      weekRange,
    });
  }

  return NextResponse.json({ success: true });
}
