'use client';

import { useEffect, useMemo, useState } from 'react';
import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { supabase } from '@/lib/supabase-client';
import type { Session } from '@/types/session';
import { calculateReadiness } from '@/lib/readiness';

type CompletedRow = {
  date?: string;
  session_date?: string;
  session_title?: string;
  title?: string;
};

type ChecklistItem = {
  id: string;
  label: string;
};

type ChecklistSection = {
  key: string;
  title: string;
  items: ChecklistItem[];
};

const CHECKLIST_SECTIONS: ChecklistSection[] = [
  {
    key: 'gear-swim',
    title: 'Gear checklist — Swim',
    items: [
      { id: 'swim-wetsuit', label: 'Wetsuit / swimskin ready' },
      { id: 'swim-goggles', label: 'Primary + backup goggles packed' },
      { id: 'swim-cap', label: 'Race cap + anti-chafe packed' },
    ],
  },
  {
    key: 'gear-bike',
    title: 'Gear checklist — Bike',
    items: [
      { id: 'bike-mech', label: 'Bike safety + mechanical check done' },
      { id: 'bike-kit', label: 'Helmet, shoes, race belt packed' },
      { id: 'bike-tools', label: 'CO2 / tube / mini tool packed' },
    ],
  },
  {
    key: 'gear-run',
    title: 'Gear checklist — Run',
    items: [
      { id: 'run-shoes', label: 'Race shoes + socks selected' },
      { id: 'run-hat', label: 'Hat/visor + sunglasses packed' },
      { id: 'run-bib', label: 'Bib + safety pins / belt ready' },
    ],
  },
  {
    key: 'gear-general',
    title: 'Gear checklist — General',
    items: [
      { id: 'gen-weather', label: 'Weather-specific layers prepared' },
      { id: 'gen-electronics', label: 'Watch + HRM charged' },
      { id: 'gen-docs', label: 'ID, USAT/license, confirmations ready' },
    ],
  },
  {
    key: 'nutrition',
    title: 'Nutrition checklist',
    items: [
      { id: 'nut-plan', label: 'Fuel plan written by hour / segment' },
      { id: 'nut-race', label: 'Race-day breakfast rehearsed' },
      { id: 'nut-carry', label: 'Gels, hydration, sodium packed' },
    ],
  },
  {
    key: 'logistics',
    title: 'Logistics checklist',
    items: [
      { id: 'log-checkin', label: 'Packet pickup + check-in scheduled' },
      { id: 'log-transport', label: 'Travel + parking plan confirmed' },
      { id: 'log-timeline', label: 'Race-morning timeline documented' },
    ],
  },
];

function countdownLabel(raceDate?: string | null) {
  if (!raceDate) return 'Race date not set';
  try {
    const race = parseISO(raceDate);
    const days = differenceInCalendarDays(race, new Date());
    if (days > 1) return `${days} days to race`;
    if (days === 1) return '1 day to race';
    if (days === 0) return 'Race day';
    return `${Math.abs(days)} days since race day`;
  } catch {
    return 'Race date not set';
  }
}

export default function RacePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [completedRows, setCompletedRows] = useState<CompletedRow[]>([]);
  const [raceType, setRaceType] = useState<string | null>(null);
  const [raceDate, setRaceDate] = useState<string | null>(null);
  const [raceName, setRaceName] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();

        if (userErr) throw userErr;
        if (!user) {
          if (!cancelled) setError('Please sign in to view race prep.');
          return;
        }

        const [sessionsRes, completedRes, latestPlanRes] = await Promise.all([
          supabase.from('sessions').select('*').eq('user_id', user.id),
          supabase.from('completed_sessions').select('*').eq('user_id', user.id),
          supabase
            .from('plans')
            .select('race_type, race_date, plan')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        if (sessionsRes.error) throw sessionsRes.error;
        if (completedRes.error) throw completedRes.error;
        if (latestPlanRes.error) throw latestPlanRes.error;

        if (cancelled) return;

        setSessions((sessionsRes.data ?? []) as Session[]);
        setCompletedRows((completedRes.data ?? []) as CompletedRow[]);

        const latestPlan = latestPlanRes.data as any;
        setRaceType(latestPlan?.race_type ?? null);
        setRaceDate(latestPlan?.race_date ?? null);
        setRaceName(latestPlan?.plan?.params?.raceName ?? null);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to load race hub.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('race-hub-checklist-v1');
      if (raw) setChecked(JSON.parse(raw));
    } catch {
      // ignore storage read errors
    }
  }, []);

  const readiness = useMemo(
    () =>
      calculateReadiness({
        sessions,
        completedSessions: completedRows,
        raceDate,
      }),
    [sessions, completedRows, raceDate]
  );

  const raceDateLabel = useMemo(() => {
    if (!raceDate) return 'Date not set';
    try {
      return format(parseISO(raceDate), 'EEE, MMM d, yyyy');
    } catch {
      return 'Date not set';
    }
  }, [raceDate]);

  const toggleChecklist = (id: string) => {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        window.localStorage.setItem('race-hub-checklist-v1', JSON.stringify(next));
      } catch {
        // ignore storage write errors
      }
      return next;
    });
  };

  if (loading) {
    return <div className="p-6 text-sm text-zinc-500">Loading race hub…</div>;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Race Hub</p>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">{raceName?.trim() || raceType || 'Target race'}</h1>
        <p className="mt-1 text-sm text-gray-600">{raceDateLabel}</p>
        <p className="mt-2 inline-flex rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-sm font-medium text-gray-700">
          {countdownLabel(raceDate)}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href="/schedule"
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Back to Schedule
          </a>
          <a
            href={`/coaching?q=${encodeURIComponent(`Race prep check-in for ${raceType ?? 'my race'} on ${raceDate ?? 'TBD'}. What should I focus on this week?`)}`}
            className="inline-flex items-center rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Ask coach about race prep
          </a>
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Readiness</p>
        <h2 className="mt-1 text-xl font-semibold text-gray-900">{readiness.score}/100 · {readiness.label}</h2>
        <p className="mt-2 text-sm text-gray-600">
          Score based on adherence, consistency, and race proximity. Use this as directional feedback, then adjust training and logistics this week.
        </p>
      </section>

      <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900">Race checklist</h3>
        <p className="mt-1 text-sm text-gray-600">Local checklist state is saved on this device.</p>

        <div className="mt-4 space-y-4">
          {CHECKLIST_SECTIONS.map((section) => (
            <div key={section.key} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <h4 className="text-sm font-semibold text-gray-900">{section.title}</h4>
              <div className="mt-3 space-y-2">
                {section.items.map((item) => (
                  <label key={item.id} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={Boolean(checked[item.id])}
                      onChange={() => toggleChecklist(item.id)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
