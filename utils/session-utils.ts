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
      return 'bg-[#e0f2ff] text-[#0369a1]'; // light aqua, deep blue
    case 'bike':
      return 'bg-[#fffacc] text-[#854d0e]'; // butter yellow, brown
    case 'run':
      return 'bg-[#dcfce7] text-[#15803d]'; // mint green, forest
    case 'rest':
      return 'bg-[#f4f4f5] text-[#71717a] italic'; // soft gray
    default:
      return 'bg-zinc-200 text-zinc-700'; // fallback
  }
}

