'use client';

import { format, isAfter, parseISO } from 'date-fns';

type Session = {
  date: string;
  title: string;
  sport?: string;
};

export default function SidebarCalendar({ sessions }: { sessions: Session[] }) {
  const today = new Date();

  const upcoming = sessions
    .filter((s) => isAfter(parseISO(s.date), today))
    .sort((a, b) => (a.date > b.date ? 1 : -1))
    .slice(0, 5);

  return (
    <aside className="hidden lg:flex flex-col w-[280px] min-w-[260px] max-w-[320px] bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-6">
      {/* Mini calendar placeholder */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Mini Calendar</h2>
        <div className="text-center text-gray-400 text-sm italic">[Calendar Coming Soon]</div>
      </div>

      {/* Upcoming Sessions */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Upcoming Sessions</h2>
        <ul className="space-y-3">
          {upcoming.map((s, idx) => (
            <li key={idx} className="flex flex-col">
              <span className="text-xs text-gray-400">
                {format(parseISO(s.date), 'EEE MMM d')}
              </span>
              <span className="text-sm text-gray-800 truncate">{s.title}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
