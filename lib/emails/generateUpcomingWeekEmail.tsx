// lib/emails/generateUpcomingWeekEmail.tsx
import { UpcomingWeekEmail } from './UpcomingWeekEmail';
import { render } from '@react-email/components';
import { format, parseISO } from 'date-fns';

export function generateUpcomingWeekEmail({
  sessions,
  coachNote,
  weekRange,
}: {
  sessions: {
    date: string;
    sport: string;
    title: string;
  }[];
  coachNote: string;
  weekRange: string;
}) {
  // Simple emoji based on keyword in title
  const getEmoji = (title: string) => {
    if (title.includes('🏊') || title.toLowerCase().includes('swim')) return '🏊';
    if (title.includes('🚴') || title.toLowerCase().includes('bike')) return '🚴';
    if (title.includes('🏃') || title.toLowerCase().includes('run')) return '🏃';
    return '🏋️';
  };

  // Group sessions by day
  const groupedByDay: Record<string, string[]> = {};

  for (const s of sessions) {
    const day = format(parseISO(s.date), 'EEE'); // e.g. 'Mon'
    const emoji = getEmoji(s.title);
    const line = `${emoji} ${s.title}`;

    if (!groupedByDay[day]) groupedByDay[day] = [];
    groupedByDay[day].push(line);
  }

  return render(
    UpcomingWeekEmail({
      coachNote,
      weekRange,
      groupedSessions: groupedByDay,
    })
  );
}
