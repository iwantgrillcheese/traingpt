import type { Session } from '@/types/session';
import { formatISO } from 'date-fns';

export function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

export function groupSessionsByDate(sessions: Session[]) {
  return sessions.reduce<Record<string, Session[]>>((acc, session) => {
    const key = formatISO(new Date(session.date), { representation: 'date' });
    if (!acc[key]) acc[key] = [];
    acc[key].push(session);
    return acc;
  }, {});
}

// ✅ Updated color contrast for better visual clarity
export function getSessionColor(sport: string): string {
  switch (sport.toLowerCase()) {
    case 'swim':
      return 'bg-accent-swim/20 text-accent-swim';
    case 'bike':
      return 'bg-accent-bike/20 text-accent-bike';
    case 'run':
      return 'bg-accent-run/20 text-accent-run';
    case 'rest':
      return 'bg-accent-rest/30 text-zinc-500 italic';
    default:
      return 'bg-zinc-200 text-zinc-700';
  }
}
