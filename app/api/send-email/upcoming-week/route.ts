import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { startOfWeek, addDays, format } from 'date-fns';
import { sendUpcomingWeekEmail } from '@/lib/emails/send-upcoming-week-email';

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

    // 1. Find the latest plan for this user
const { data: plans } = await supabase
  .from('plans')
  .select('id')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false })
  .limit(1);

const planId = plans?.[0]?.id;
if (!planId) continue;

// 2. Find sessions tied to that plan
const { data: sessions } = await supabase
  .from('sessions')
  .select('date, sport, title, duration_minutes')
  .eq('plan_id', planId)
  .gte('date', start.toISOString())
  .lte('date', end.toISOString());

    if (!sessions?.length) continue;

    const coachNote = `You're entering a key training week. Keep showing up — consistency wins.`;

    await sendUpcomingWeekEmail({
      email: user.email,
      sessions,
      coachNote,
      weekRange,
    });
  }

  return NextResponse.json({ success: true });
}
