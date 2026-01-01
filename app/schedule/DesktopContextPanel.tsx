'use client';

import { useMemo } from 'react';
import { format, startOfWeek, endOfWeek, isAfter, parseISO } from 'date-fns';
import type { MergedSession } from '@/utils/mergeSessionWithStrava';

type CompletedSession = {
  date: string;
  session_title: string;
  strava_id?: string;
};

function safeParseDate(d: string) {
  try {
    return parseISO(d);
  } catch {
    return null;
  }
}

function getSessionTitle(s: any) {
  return (
    s.session_title ||
    s.title ||
    s.sessionTitle ||
    s.name ||
    'Training session'
  );
}

function getSessionSport(s: any) {
  const raw =
    (s.sport || s.type || '').toString().toLowerCase();
  if (raw.includes('swim')) return 'swim';
  if (raw.includes('bike') || raw.includes('ride') || raw.includes('cycle')) return 'bike';
  if (raw.includes('run')) return 'run';
  if (raw.includes('strength') || raw.includes('lift')) return 'strength';
  if (raw.includes('rest')) return 'rest';
  return raw || 'other';
}

export default function DesktopContextPanel({
  currentMonth,
  localSessions,
  completedSessions,
}: {
  currentMonth: Date;
  localSessions: MergedSession[];
  completedSessions: CompletedSession[];
}) {
  const today = new Date();

  const {
    weekLabel,
    plannedThisWeek,
    completedThisWeek,
    complianceThisWeek,
    nextUp,
    sportCountsThisWeek,
  } = useMemo(() => {
    const ws = startOfWeek(today, { weekStartsOn: 1 });
    const we = endOfWeek(today, { weekStartsOn: 1 });

    const inThisWeek = (dateStr?: string | null) => {
      if (!dateStr) return false;
      const d = safeParseDate(dateStr);
      if (!d) return false;
      return d >= ws && d <= we;
    };

    const plannedWeek = localSessions.filter((s) => inThisWeek((s as any).date));
    const completedWeek = completedSessions.filter((c) => inThisWeek(c.date));

    // “good enough” compliance: completed count / planned count for the week
    const plannedCount = plannedWeek.length;
    const completedCount = Math.min(completedWeek.length, plannedCount);
    const compliance =
      plannedCount === 0 ? 0 : Math.round((completedCount / plannedCount) * 100);

    // Next upcoming session: earliest session after now
    const upcoming = localSessions
      .map((s) => ({ s, d: safeParseDate((s as any).date) }))
      .filter((x) => x.d && isAfter(x.d!, today))
      .sort((a, b) => a.d!.getTime() - b.d!.getTime());

    const next = upcoming[0]?.s ?? null;

    const counts: Record<string, number> = {};
    plannedWeek.forEach((s) => {
      const sport = getSessionSport(s);
      counts[sport] = (counts[sport] || 0) + 1;
    });

    return {
      weekLabel: `${format(ws, 'MMM d')}–${format(we, 'MMM d')}`,
      plannedThisWeek: plannedCount,
      completedThisWeek: completedCount,
      complianceThisWeek: compliance,
      nextUp: next,
      sportCountsThisWeek: counts,
    };
  }, [localSessions, completedSessions]);

  const complianceTone =
    complianceThisWeek >= 85
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : complianceThisWeek >= 60
        ? 'text-amber-700 bg-amber-50 border-amber-200'
        : 'text-rose-700 bg-rose-50 border-rose-200';

  return (
    <aside className="sticky top-6 h-fit rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <div className="text-xs text-gray-500">This week</div>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <div className="text-lg font-semibold text-gray-900">{weekLabel}</div>
          <div className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${complianceTone}`}>
            {complianceThisWeek}% compliance
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
          <div className="text-xs text-gray-500">Planned</div>
          <div className="mt-1 text-xl font-semibold text-gray-900">{plannedThisWeek}</div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
          <div className="text-xs text-gray-500">Completed</div>
          <div className="mt-1 text-xl font-semibold text-gray-900">{completedThisWeek}</div>
        </div>
      </div>

      <div className="mt-5">
        <div className="text-sm font-semibold text-gray-900">Next up</div>
        {nextUp ? (
          <div className="mt-2 rounded-xl border border-gray-200 bg-white p-3">
            <div className="text-xs text-gray-500">
              {format(parseISO((nextUp as any).date), 'EEE, MMM d')}
            </div>
            <div className="mt-1 text-sm font-medium text-gray-900">
              {getSessionTitle(nextUp)}
            </div>
            <div className="mt-1 text-xs text-gray-500">
              {getSessionSport(nextUp)}
            </div>
          </div>
        ) : (
          <div className="mt-2 text-sm text-gray-500">No upcoming sessions found.</div>
        )}
      </div>

      <div className="mt-5">
        <div className="text-sm font-semibold text-gray-900">This week mix</div>
        <div className="mt-2 space-y-2">
          {Object.entries(sportCountsThisWeek)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([sport, count]) => (
              <div key={sport} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 capitalize">{sport}</span>
                <span className="text-gray-500">{count}</span>
              </div>
            ))}
          {Object.keys(sportCountsThisWeek).length === 0 ? (
            <div className="text-sm text-gray-500">No planned sessions this week.</div>
          ) : null}
        </div>
      </div>

      <div className="mt-5 border-t border-gray-100 pt-4 text-xs text-gray-500">
        Tip: click any session to open the modal and generate a structured workout.
      </div>
    </aside>
  );
}
