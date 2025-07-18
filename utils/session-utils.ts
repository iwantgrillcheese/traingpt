// /utils/session-utils.ts
import type { Session } from '@/types/session';
import { formatISO, parseISO } from 'date-fns';

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
      return 'bg-blue-200 text-blue-800';
    case 'bike':
      return 'bg-yellow-200 text-yellow-800';
    case 'run':
      return 'bg-green-200 text-green-800';
    case 'strength':
      return 'bg-red-200 text-red-800';
    default:
      return 'bg-gray-200 text-gray-700';
  }
}
