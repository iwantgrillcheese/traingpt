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
      return 'bg-blue-100 text-blue-700';
    case 'bike':
      return 'bg-yellow-100 text-yellow-700';
    case 'run':
      return 'bg-green-100 text-green-700';
    case 'rest':
      return 'bg-zinc-100 text-zinc-400 italic';
    default:
      return 'bg-zinc-200 text-zinc-700';
  }
}
