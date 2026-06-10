// lib/emails/generateUpcomingWeekEmail.tsx
import { UpcomingWeekEmail } from './UpcomingWeekEmail';
import { render } from '@react-email/components';
import { format, parseISO } from 'date-fns';

type EmailSession = {
  date: string;
  sport: string;
  title: string;
  duration_minutes?: number;
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function titleCaseSport(value: string) {
  const sport = value.trim().toLowerCase();
  if (sport === 'swim') return 'Swim';
  if (sport === 'bike') return 'Bike';
  if (sport === 'run') return 'Run';
  if (sport === 'strength') return 'Strength';
  return 'Other';
}

function stripEmoji(value: string) {
  return value
    .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|[\uD83C-\uDBFF\uDC00-\uDFFF])/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatDuration(minutes?: number) {
  if (!Number.isFinite(minutes) || !minutes || minutes <= 0) return null;
  if (minutes < 60) return `${Math.round(minutes)} min`;

  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

function summarizeSessions(sessions: EmailSession[]) {
  const sportCounts = sessions.reduce<Record<string, number>>((acc, session) => {
    const sport = titleCaseSport(session.sport);
    acc[sport] = (acc[sport] ?? 0) + 1;
    return acc;
  }, {});

  const totalMinutes = sessions.reduce((acc, session) => {
    const duration = Number(session.duration_minutes);
    return Number.isFinite(duration) && duration > 0 ? acc + duration : acc;
  }, 0);

  const sportSummary = ['Swim', 'Bike', 'Run', 'Strength']
    .filter((sport) => sportCounts[sport])
    .map((sport) => `${sportCounts[sport]} ${sport.toLowerCase()}`)
    .join(' · ');

  return {
    sessionCount: sessions.length,
    totalDuration: totalMinutes > 0 ? formatDuration(totalMinutes) : null,
    sportSummary: sportSummary || `${sessions.length} planned sessions`,
  };
}

export function generateUpcomingWeekEmail({
  sessions,
  weekRange,
  coachNote,
}: {
  sessions: EmailSession[];
  weekRange: string;
  coachNote?: string | null;
}) {
  const groupedByDay = Object.fromEntries(
    WEEKDAYS.map((day) => [day, [] as Array<{ title: string; sport: string; duration: string | null }>])
  );

  for (const session of sessions) {
    const day = format(parseISO(session.date), 'EEE');
    const safeDay = groupedByDay[day] ? day : 'Mon';

    groupedByDay[safeDay].push({
      title: stripEmoji(session.title),
      sport: titleCaseSport(session.sport),
      duration: formatDuration(session.duration_minutes),
    });
  }

  return render(
    UpcomingWeekEmail({
      weekRange,
      groupedSessions: groupedByDay,
      summary: summarizeSessions(sessions),
      coachNote,
    })
  );
}
