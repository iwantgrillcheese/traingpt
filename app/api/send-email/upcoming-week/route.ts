import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { startOfWeek, addDays, format } from 'date-fns';
import { sendUpcomingWeekEmail } from '@/lib/emails/send-upcoming-week-email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ProfileRow = {
  id: string;
  email: string | null;
};

type SessionRow = {
  user_id: string;
  date: string;
  sport: string | null;
  title: string | null;
  session_title?: string | null;
  duration?: number | null;
  status?: string | null;
};

function isAuthorizedCronRequest(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();

  // Keep manual testing simple if no secret has been configured yet.
  if (!cronSecret) return true;

  const authHeader = req.headers.get('authorization') ?? '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const querySecret = req.nextUrl.searchParams.get('secret') ?? '';

  return bearerToken === cronSecret || querySecret === cronSecret;
}

function formatSport(value: string | null | undefined) {
  const sport = String(value ?? 'other').trim().toLowerCase();
  if (sport === 'swim') return 'Swim';
  if (sport === 'bike') return 'Bike';
  if (sport === 'run') return 'Run';
  if (sport === 'strength') return 'Strength';
  return 'Other';
}

function getReminderWeekRange(now = new Date()) {
  const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });

  // Vercel currently runs this cron on Sunday. On Sunday, send the week ahead,
  // not the Monday-Sunday block that just ended.
  const start = now.getDay() === 0 ? addDays(currentWeekStart, 7) : currentWeekStart;
  const end = addDays(start, 6);

  return {
    start,
    end,
    startISO: format(start, 'yyyy-MM-dd'),
    endISO: format(end, 'yyyy-MM-dd'),
    weekRange: `${format(start, 'MMM d')} – ${format(end, 'MMM d')}`,
  };
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { success: false, error: 'SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured' },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const testEmail = req.nextUrl.searchParams.get('test');
  const { startISO, endISO, weekRange } = getReminderWeekRange();

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email')
    .not('email', 'is', null);

  if (profilesError) {
    console.error('❌ Error fetching profiles:', profilesError);
    return NextResponse.json({ success: false, error: profilesError.message }, { status: 500 });
  }

  const targetProfiles = (profiles ?? []).filter((profile: ProfileRow) => {
    if (!profile.email) return false;
    return testEmail ? profile.email.toLowerCase() === testEmail.toLowerCase() : true;
  });

  let sent = 0;
  let skipped = 0;
  const errors: Array<{ email: string; error: string }> = [];

  for (const user of targetProfiles) {
    if (!user.email) continue;

    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('user_id, date, sport, title, session_title, duration, status')
      .eq('user_id', user.id)
      .gte('date', startISO)
      .lte('date', endISO)
      .order('date', { ascending: true });

    if (sessionsError) {
      console.error(`❌ Error fetching sessions for ${user.email}:`, sessionsError);
      errors.push({ email: user.email, error: sessionsError.message });
      continue;
    }

    const { data: adaptationRows } = await supabase
      .from('plan_adaptations')
      .select('summary, created_at')
      .eq('user_id', user.id)
      .gte('created_at', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    const adaptationSummary = adaptationRows?.[0]?.summary ?? null;

    const sessionsThisWeek = (sessions ?? [])
      .filter((session: SessionRow) => session.status !== 'skipped')
      .map((session: SessionRow) => ({
        date: session.date,
        sport: formatSport(session.sport),
        title: session.title || session.session_title || `${formatSport(session.sport)} Session`,
        duration_minutes: session.duration ?? undefined,
      }));

    if (!sessionsThisWeek.length) {
      skipped += 1;
      console.log(`⛔ No sessions for ${user.email} during ${weekRange}`);
      continue;
    }

    try {
      console.log(`✅ Sending weekly plan email to ${user.email} with ${sessionsThisWeek.length} sessions`);

      await sendUpcomingWeekEmail({
        email: user.email,
        sessions: sessionsThisWeek,
        coachNote: adaptationSummary ?? `Your week is set. Check the plan, adjust around real life, and use your AI coach whenever you need clarity.`,
        weekRange,
      });

      sent += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`❌ Failed sending weekly plan email to ${user.email}:`, err);
      errors.push({ email: user.email, error: message });
    }
  }

  return NextResponse.json({
    success: true,
    weekRange,
    startISO,
    endISO,
    checked: targetProfiles.length,
    testMode: Boolean(testEmail),
    sent,
    skipped,
    errors,
  });
}
