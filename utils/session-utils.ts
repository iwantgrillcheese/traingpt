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

// session-utils.ts
// utils/session-utils.ts

export function getSessionColor(sport: string | null | undefined): string {
  const safe = sport?.toLowerCase?.() || '';

  switch (safe) {
    case 'swim':
      return 'bg-blue-50 text-blue-800 border border-blue-100';
    case 'bike':
      return 'bg-yellow-50 text-yellow-800 border border-yellow-100';
    case 'run':
      return 'bg-green-50 text-green-800 border border-green-100';
    case 'strength':
      return 'bg-purple-50 text-purple-800 border border-purple-100';
    case 'rest':
      return 'bg-zinc-50 text-zinc-500 border border-zinc-200 italic';
    default:
      return 'bg-neutral-100 text-neutral-700 border border-neutral-200';
  }
}
