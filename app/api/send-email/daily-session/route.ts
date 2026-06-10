// /app/api/send-email/daily-session/route.ts
//
// Daily trigger for the training loop: every morning, send opted-in athletes
// (profiles.daily_email_opt_in = true) their session(s) for the day, with the
// full prescription in the body and the workout as the subject line.
//
// Mirrors the upcoming-week cron: CRON_SECRET auth, service-role client,
// per-user send loop, ?test=email and ?date=YYYY-MM-DD overrides for manual runs.
//
// Timezone note (v1): "today" is computed in America/Los_Angeles and the cron
// fires at 13:00 UTC (6am PT / 9am ET), which lands in the morning across US
// timezones. Per-user timezones are a follow-up once we store one.

import { NextResponse, NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { sendDailySessionEmail } from '@/lib/emails/send-daily-session-email';
import type { DailyEmailSession } from '@/lib/emails/DailySessionEmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

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
  details?: string | null;
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

function formatDuration(minutes?: number | null) {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) return null;
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

/** Today's calendar date + label in a fixed reference timezone (v1: US Pacific). */
function getTodayInReferenceTz(override?: string | null) {
  const tz = process.env.DAILY_EMAIL_TIMEZONE || 'America/Los_Angeles';

  if (override && /^\d{4}-\d{2}-\d{2}$/.test(override)) {
    const date = new Date(`${override}T12:00:00Z`);
    const label = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(date);
    return { todayISO: override, dayLabel: label };
  }

  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now); // en-CA yields YYYY-MM-DD

  const label = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(now);

  return { todayISO: parts, dayLabel: label };
}

/** Keep the four coach lines, drop placeholder junk, cap length for email. */
function detailLinesFrom(details?: string | null): string[] {
  const text = String(details ?? '').trim();
  if (!text) return [];

  const lines = text
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean);

  const labeled = lines.filter((line) => /^(purpose|workout|intensity|coach note):/i.test(line));
  const chosen = (labeled.length ? labeled : lines).slice(0, 4);

  return chosen.map((line) => (line.length > 280 ? `${line.slice(0, 277)}…` : line));
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
  const dateOverride = req.nextUrl.searchParams.get('date');
  const { todayISO, dayLabel } = getTodayInReferenceTz(dateOverride);

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('daily_email_opt_in', true)
    .not('email', 'is', null);

  if (profilesError) {
    console.error('[daily-session] error fetching profiles:', profilesError);
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
      .select('user_id, date, sport, title, session_title, duration, details, status')
      .eq('user_id', user.id)
      .eq('date', todayISO)
      .order('created_at', { ascending: true });

    if (sessionsError) {
      console.error(`[daily-session] error fetching sessions for ${user.email}:`, sessionsError);
      errors.push({ email: user.email, error: sessionsError.message });
      continue;
    }

    const todaysSessions: DailyEmailSession[] = (sessions ?? [])
      .filter((session: SessionRow) => {
        const status = String(session.status ?? 'planned').toLowerCase();
        if (status === 'skipped' || status === 'done') return false;
        const sport = String(session.sport ?? '').toLowerCase();
        const title = String(session.title ?? session.session_title ?? '').toLowerCase();
        return !(sport === 'rest' || /\brest day\b/.test(title));
      })
      .map((session: SessionRow) => ({
        sport: formatSport(session.sport),
        title: session.title || session.session_title || `${formatSport(session.sport)} Session`,
        duration: formatDuration(session.duration),
        detailLines: detailLinesFrom(session.details),
      }));

    if (!todaysSessions.length) {
      skipped += 1;
      continue;
    }

    try {
      await sendDailySessionEmail({
        email: user.email,
        dayLabel,
        sessions: todaysSessions,
      });
      sent += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[daily-session] failed sending to ${user.email}:`, err);
      errors.push({ email: user.email, error: message });
    }
  }

  return NextResponse.json({
    success: true,
    date: todayISO,
    checked: targetProfiles.length,
    testMode: Boolean(testEmail),
    sent,
    skipped,
    errors,
  });
}
