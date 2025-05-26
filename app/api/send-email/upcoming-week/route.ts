import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { startOfWeek, addDays, format } from 'date-fns';
import { sendUpcomingWeekEmail } from '@/lib/emails/send-upcoming-week-email';

export const runtime = 'nodejs';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const testEmail = req.nextUrl.searchParams.get('test');

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
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (planError) {
      console.error(`❌ Error fetching plans for ${user.email}:`, planError);
      continue;
    }

    const planId = plans?.[0]?.id;
    if (!planId) {
      console.log(`⛔ No plan found for user ${user.email}`);
      continue;
    }

    console.log(`✅ Found plan: ${planId}`);

    const { data: sessions, error: sessionError } = await supabase
      .from('sessions')
      .select('date, sport, title, duration_minutes')
      .eq('plan_id', planId)
      .gte('date', start.toISOString())
      .lte('date', end.toISOString());

    if (sessionError) {
      console.error(`❌ Error fetching sessions for ${user.email}:`, sessionError);
      continue;
    }

    if (!sessions?.length) {
      console.log(`⛔ No sessions found for user ${user.email}`);
      continue;
    }

    console.log(`✅ Sending email to ${user.email} with ${sessions.length} sessions`);

    await sendUpcomingWeekEmail({
      email: user.email,
      sessions,
      coachNote: `You're entering a key training week. Keep showing up — consistency wins.`,
      weekRange,
    });
  }

  return NextResponse.json({ success: true });
}
