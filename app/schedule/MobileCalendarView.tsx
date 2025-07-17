'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  format,
  parseISO,
  isSameDay,
  addDays,
} from 'date-fns';
import { generateCoachQuestion } from '@/utils/generateCoachQuestion';

export default function MobileCalendarView({
  plan,
  completed,
  stravaActivities,
}: {
  plan: {
    weeks: {
      label: string;
      phase: string;
      startDate: string;
      days: Record<string, string[]>;
    }[];
  };
  completed: Record<string, string>;
  stravaActivities: any[];
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [detailedWorkouts, setDetailedWorkouts] = useState<Record<string, string>>({});
  const router = useRouter();

  const toggleWeek = (startDate: string) => {
    setCollapsed((prev) => ({ ...prev, [startDate]: !prev[startDate] }));
  };

  const getSessionStatus = (date: string, label: string) => {
    const key = `${date}-${
      label.toLowerCase().includes('swim')
        ? 'swim'
        : label.toLowerCase().includes('bike')
        ? 'bike'
        : 'run'
    }`;
    return completed[key];
  };

  const getEmoji = (title: string) => {
    if (title.toLowerCase().includes('swim')) return '🏊';
    if (title.toLowerCase().includes('bike')) return '🚴';
    if (title.toLowerCase().includes('run')) return '🏃';
    return '📋';
  };

  const handleGenerateWorkout = async (title: string, date: string) => {
    const res = await fetch('/api/generate-detailed-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, date }),
    });
    const { workout } = await res.json();
    const key = `${date}-${title}`;
    setDetailedWorkouts((prev) => ({ ...prev, [key]: workout }));
  };

  const handleSessionClick = (dateStr: string, session: string) => {
    const question = generateCoachQuestion(format(parseISO(dateStr), 'MMMM d'), session);
    router.push(`/coaching?q=${encodeURIComponent(question)}`);
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 pb-10">
      {plan.weeks.map((week) => {
        const weekStart = parseISO(week.startDate);
        const dateLabel = `Week of ${format(weekStart, 'MMM d')}`;
        const isOpen = !collapsed[week.startDate];

        const weekDates = Array.from({ length: 7 }).map((_, i) =>
          format(addDays(weekStart, i), 'yyyy-MM-dd')
        );

        return (
          <div key={week.startDate} className="mb-6">
            <button
              onClick={() => toggleWeek(week.startDate)}
              className="w-full text-left text-[15px] font-medium text-gray-800 flex justify-between items-center py-2"
            >
              <span>
                {dateLabel} — {week.phase}
              </span>
              <span className="text-gray-500">{isOpen ? '▾' : '▸'}</span>
            </button>

            {isOpen && (
              <div className="space-y-4 mt-2">
                {weekDates.map((dateStr) => {
                  const sessions = week.days[dateStr] || [];
                  return (
                    <div key={dateStr} className="bg-white border border-neutral-200 rounded-xl shadow-sm p-3">
                      <div className="text-xs text-gray-500 font-medium mb-2">
                        {format(parseISO(dateStr), 'EEEE, MMMM d')}
                      </div>

                      {sessions.length === 0 && (
                        <div className="text-sm text-gray-400 italic">No session</div>
                      )}

                      {sessions.map((s, i) => {
                        const key = `${dateStr}-${s}`;
                        return (
                          <div key={i} className="flex flex-col gap-2 mb-3">
                            <div className="flex items-start gap-2">
                              <span>{getEmoji(s)}</span>
                              <span
                                onClick={() => handleSessionClick(dateStr, s)}
                                className="text-blue-600 underline cursor-pointer text-sm"
                              >
                                {s.replace(/^\w+: /, '')}
                              </span>
                            </div>

                            {detailedWorkouts[key] ? (
                              <div className="bg-neutral-50 border border-neutral-200 rounded-md p-2 text-[13px] whitespace-pre-wrap">
                                {detailedWorkouts[key]}
                              </div>
                            ) : (
                              <button
                                onClick={() => handleGenerateWorkout(s, dateStr)}
                                className="self-start text-xs text-blue-600 underline"
                              >
                                Generate detailed workout
                              </button>
                            )}
                          </div>
                        );
                      })}

                      <textarea
                        placeholder="Leave a note..."
                        className="mt-2 w-full border border-neutral-300 rounded-md p-2 text-sm"
                        rows={2}
                      />

                      <div className="flex justify-end gap-3 mt-3">
                        <button className="text-sm text-gray-500">Skip</button>
                        <button className="bg-black text-white text-sm px-4 py-1.5 rounded-md">Mark Done</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
