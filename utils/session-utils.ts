// utils/session-utils.ts
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

export function getSessionColor(sport: string): string {
  switch (sport.toLowerCase()) {
    case 'swim':
      return 'bg-blue-50 text-blue-600';
    case 'bike':
      return 'bg-yellow-50 text-yellow-600';
    case 'run':
      return 'bg-green-50 text-green-600';
    case 'rest':
      return 'bg-zinc-100 text-zinc-400 italic';
    default:
      return 'bg-zinc-200 text-zinc-700';
  }
}
