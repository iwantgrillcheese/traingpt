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
// session-utils.ts
export function getSessionColor(sport: string): string {
  switch (sport?.toLowerCase()) {
    case 'swim':
      return 'bg-[#E0F2FE] text-[#60A5FA]';
    case 'bike':
      return 'bg-[#D1FAE5] text-[#34D399]';
    case 'run':
      return 'bg-[#FEF9C3] text-[#FBBF24]';
    case 'rest':
      return 'bg-[#F3F4F6] text-zinc-500 italic'; // muted gray
    default:
      return 'bg-zinc-100 text-zinc-700';
  }
}

