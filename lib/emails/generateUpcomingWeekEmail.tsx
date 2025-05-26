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
    duration_minutes: number;
  }[];
  coachNote: string;
  weekRange: string;
}) {
  const getEmoji = (sport: string) => {
    if (sport === 'Swim') return '🏊';
    if (sport.includes('Ride')) return '🚴';
    if (sport === 'Run') return '🏃';
    return '🏋️';
  };

  const formattedSessions = sessions.map(s => ({
    day: format(parseISO(s.date), 'EEE'),
    emoji: getEmoji(s.sport),
    title: s.title,
    duration: Math.round(s.duration_minutes),
  }));

  return render(
    UpcomingWeekEmail({
      coachNote,
      weekRange,
      sessions: formattedSessions,
    })
  );
}
