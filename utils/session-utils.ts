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

// utils/session-utils.ts

export function getSessionColor(sport: string | null | undefined): string {
  const safe = sport?.toLowerCase?.() || '';

  switch (safe) {
    case 'swim':
      return 'bg-blue-50 text-blue-900 border border-blue-200';
    case 'bike':
      return 'bg-yellow-50 text-yellow-900 border border-yellow-200';
    case 'run':
      return 'bg-green-50 text-green-900 border border-green-200';
    case 'strength':
      return 'bg-purple-50 text-purple-900 border border-purple-200';
    case 'rest':
      return 'bg-zinc-100 text-zinc-500 italic border border-zinc-200';
    default:
      return 'bg-neutral-100 text-neutral-800 border border-neutral-200';
  }
}
