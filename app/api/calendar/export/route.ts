import { NextResponse } from 'next/server';
import {
  AuthError,
  createRouteSupabaseClient,
  requireUser,
} from '@/lib/supabase/server';
import { getBillingAccess } from '@/lib/billing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SessionRow = {
  id: string;
  date: string | null;
  sport: string | null;
  title: string | null;
  duration: number | null;
  details: string | null;
  structured_workout: string | null;
};

function escapeIcs(value: string) {
  return String(value ?? '')
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replace(/\r?\n/g, '\\n');
}

function foldIcsLine(line: string) {
  const chunks: string[] = [];
  let rest = line;

  while (rest.length > 74) {
    chunks.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }

  chunks.push(rest);
  return chunks.join('\r\n');
}

function toIcsDate(value: string) {
  return value.replace(/-/g, '');
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDuration(minutes?: number | null) {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) return null;
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

function cleanTitle(title?: string | null) {
  return String(title ?? 'Training session')
    .replace(/^\p{Extended_Pictographic}\s*/u, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function buildDescription(session: SessionRow) {
  const parts = [
    session.sport ? `Sport: ${session.sport}` : null,
    formatDuration(session.duration) ? `Planned duration: ${formatDuration(session.duration)}` : null,
    session.details ? `Plan details: ${session.details}` : null,
    session.structured_workout ? `Detailed workout: ${session.structured_workout}` : null,
    'Created by TrainGPT',
  ].filter(Boolean);

  return parts.join('\n\n');
}

function buildCalendar(sessions: SessionRow[], userId: string) {
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TrainGPT//Training Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:TrainGPT Training Plan',
  ];

  sessions.forEach((session, index) => {
    if (!session.date) return;

    const title = cleanTitle(session.title);
    const sport = session.sport ? String(session.sport) : 'Training';
    const summary = `TrainGPT: ${sport}${title.toLowerCase().includes(sport.toLowerCase()) ? '' : ` · ${title}`}`;
    const date = toIcsDate(session.date);
    const nextDate = toIcsDate(addDays(session.date, 1));
    const description = buildDescription(session);

    lines.push(
      'BEGIN:VEVENT',
      `UID:${escapeIcs(session.id || `${userId}-${session.date}-${index}`)}@traingpt.co`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${date}`,
      `DTEND;VALUE=DATE:${nextDate}`,
      `SUMMARY:${escapeIcs(summary)}`,
      `DESCRIPTION:${escapeIcs(description)}`,
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');
  return `${lines.map(foldIcsLine).join('\r\n')}\r\n`;
}

function redirectToLogin(req: Request) {
  const url = new URL('/login', req.url);
  url.searchParams.set('next', '/schedule');
  return NextResponse.redirect(url);
}

export async function GET(req: Request) {
  try {
    const supabase = await createRouteSupabaseClient();
    const user = await requireUser(supabase);
    const billing = await getBillingAccess(supabase, user.id);

    if (!billing.isPlusActive) {
      const url = new URL('/plan-preview', req.url);
      url.searchParams.set('feature', 'calendar-export');
      return NextResponse.redirect(url);
    }

    const { data, error } = await supabase
      .from('sessions')
      .select('id,date,sport,title,duration,details,structured_workout')
      .eq('user_id', user.id)
      .order('date', { ascending: true });

    if (error) {
      console.error('[calendar/export] sessions lookup failed', error);
      return NextResponse.json({ error: 'Could not load sessions.' }, { status: 500 });
    }

    const sessions = ((data ?? []) as SessionRow[]).filter((session) => session.date && session.title);

    if (!sessions.length) {
      return NextResponse.json({ error: 'No sessions found to export.' }, { status: 404 });
    }

    const calendar = buildCalendar(sessions, user.id);

    return new Response(calendar, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="traingpt-training-plan.ics"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return redirectToLogin(req);
    }

    console.error('[calendar/export] failed', error);
    return NextResponse.json({ error: 'Failed to export calendar.' }, { status: 500 });
  }
}
