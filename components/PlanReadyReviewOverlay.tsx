'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/AuthProvider';
import { track } from '@/lib/analytics/posthog-client';

type PlanRow = {
  id: string;
  race_type?: string | null;
  race_date?: string | null;
  plan?: any;
};

type SessionRow = {
  id: string;
  date: string | null;
  sport: string | null;
  title: string | null;
  duration: number | null;
  details?: string | null;
};

type ReviewData = {
  plan: PlanRow;
  sessions: SessionRow[];
};

function parseDate(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value?: string | null) {
  const date = parseDate(value);
  if (!date) return null;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function formatShortDate(value?: string | null) {
  const date = parseDate(value);
  if (!date) return null;
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(date);
}

function formatDuration(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  if (value < 60) return `${Math.round(value)}m`;
  const h = Math.floor(value / 60);
  const m = Math.round(value % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

function normalizeSport(value?: string | null) {
  const sport = String(value ?? '').toLowerCase();
  if (sport.includes('swim')) return 'Swim';
  if (sport.includes('bike') || sport.includes('ride')) return 'Bike';
  if (sport.includes('run')) return 'Run';
  if (sport.includes('brick')) return 'Brick';
  if (sport.includes('strength')) return 'Strength';
  if (sport.includes('rest')) return 'Rest';
  return 'Session';
}

function cleanTitle(value?: string | null) {
  return String(value ?? 'Training session')
    .replace(/^\p{Extended_Pictographic}\s*/u, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function currentWeekSessions(sessions: SessionRow[]) {
  const today = new Date();
  const day = today.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  const start = new Date(today);
  start.setDate(today.getDate() + offset);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return sessions.filter((session) => {
    const date = parseDate(session.date);
    return date && date >= start && date <= end;
  });
}

function dateRange(sessions: SessionRow[]) {
  const dates = sessions.map((session) => parseDate(session.date)).filter((date): date is Date => Boolean(date));
  if (!dates.length) return null;
  const first = new Date(Math.min(...dates.map((date) => date.getTime())));
  const last = new Date(Math.max(...dates.map((date) => date.getTime())));
  const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  return `${fmt.format(first)} – ${fmt.format(last)}`;
}

function derivePhase(plan: PlanRow) {
  const weeks = plan.plan?.weeks;
  if (!Array.isArray(weeks) || weeks.length === 0) return 'Training block';
  const firstPhase = weeks[0]?.phase ? String(weeks[0].phase) : null;
  const phases = Array.from(new Set(weeks.map((week: any) => week?.phase).filter(Boolean).map(String)));
  if (phases.length >= 3) return `${phases[0]} → ${phases[phases.length - 1]}`;
  return firstPhase ?? 'Training block';
}

function removeWalkthroughParam() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('walkthrough');
    url.searchParams.delete('planId');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  } catch {
    window.history.replaceState({}, '', '/schedule');
  }
}

export default function PlanReadyReviewOverlay() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReviewData | null>(null);

  const shouldActivate = useCallback(() => {
    if (typeof window === 'undefined') return false;
    if (pathname !== '/schedule') return false;
    return new URLSearchParams(window.location.search).get('walkthrough') === '1';
  }, [pathname]);

  useEffect(() => {
    if (authLoading || !user?.id || !shouldActivate()) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const { data: plan, error: planError } = await supabase
          .from('plans')
          .select('id,race_type,race_date,plan')
          .eq('user_id', user!.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (planError || !plan?.id) throw planError ?? new Error('No plan found');

        const { data: sessions, error: sessionsError } = await supabase
          .from('sessions')
          .select('id,date,sport,title,duration,details')
          .eq('user_id', user!.id)
          .eq('plan_id', plan.id)
          .order('date', { ascending: true })
          .limit(500);

        if (sessionsError) throw sessionsError;
        if (cancelled) return;

        setData({ plan: plan as PlanRow, sessions: (sessions ?? []) as SessionRow[] });
        setOpen(true);
        track('plan_ready_review_viewed', { plan_id: plan.id, sessions: sessions?.length ?? 0 });
      } catch (error) {
        console.error('[PlanReadyReviewOverlay] failed to load review', error);
        removeWalkthroughParam();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [authLoading, shouldActivate, user]);

  const summary = useMemo(() => {
    if (!data) return null;
    const plan = data.plan;
    const sessions = data.sessions;
    const week = currentWeekSessions(sessions);
    const totalMinutes = week.reduce((total, session) => total + (Number(session.duration) || 0), 0);
    const firstThree = week.slice(0, 3);

    return {
      planId: plan.id,
      raceLabel: plan.race_type ?? plan.plan?.params?.raceType ?? 'Training plan',
      raceDate: formatDate(plan.race_date),
      range: dateRange(sessions),
      phase: derivePhase(plan),
      weeks: Array.isArray(plan.plan?.weeks) ? plan.plan.weeks.length : null,
      totalSessions: sessions.length,
      weekSessions: week.length,
      weekVolume: formatDuration(totalMinutes),
      firstThree,
    };
  }, [data]);

  const close = () => {
    setOpen(false);
    removeWalkthroughParam();
  };

  const exportCalendar = () => {
    track('calendar_export_clicked', { source: 'plan_ready_review' });
    window.location.href = '/api/calendar/export';
  };

  const askCoach = () => {
    const prompt = encodeURIComponent('Can you walk me through my new training plan and tell me what to focus on this week?');
    close();
    router.push(`/coaching?q=${prompt}`);
  };

  if (!open || !summary) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-zinc-950/35 px-0 backdrop-blur-sm sm:items-center sm:px-4">
      <div className="max-h-[92dvh] w-full overflow-hidden rounded-t-[2rem] border border-white/70 bg-[#fbfaf8] shadow-[0_-24px_80px_rgba(15,23,42,0.24)] sm:max-w-3xl sm:rounded-[2.25rem] sm:shadow-[0_34px_120px_rgba(15,23,42,0.22)]">
        <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-zinc-200 sm:hidden" />

        <div className="max-h-[92dvh] overflow-y-auto p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Plan ready
              </div>
              <h2 className="mt-4 max-w-xl text-[34px] font-semibold leading-[0.95] tracking-[-0.06em] text-zinc-950 sm:text-5xl">
                Your training calendar is ready.
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-500">
                Here’s the quick version before you jump in. The goal is simple: know what you’re building toward, what this week looks like, and what to do next.
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50"
              aria-label="Close plan review"
            >
              ×
            </button>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Race</div>
              <div className="mt-1 text-[15px] font-semibold text-zinc-950">{summary.raceLabel}</div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Date</div>
              <div className="mt-1 text-[15px] font-semibold text-zinc-950">{summary.raceDate ?? 'Set later'}</div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Build</div>
              <div className="mt-1 text-[15px] font-semibold text-zinc-950">{summary.weeks ? `${summary.weeks} weeks` : summary.range ?? 'Ready'}</div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Phase</div>
              <div className="mt-1 text-[15px] font-semibold text-zinc-950">{summary.phase}</div>
            </div>
          </div>

          <section className="mt-4 rounded-[1.5rem] border border-zinc-200 bg-white p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">This week</div>
                <h3 className="mt-1 text-xl font-semibold tracking-[-0.04em] text-zinc-950">
                  {summary.weekSessions ? `${summary.weekSessions} sessions${summary.weekVolume ? ` · ${summary.weekVolume}` : ''}` : 'Your first sessions are ready'}
                </h3>
              </div>
              <span className="rounded-full bg-zinc-950 px-3 py-1.5 text-[12px] font-semibold text-white">Start here</span>
            </div>

            <div className="mt-4 space-y-2">
              {summary.firstThree.length ? (
                summary.firstThree.map((session) => (
                  <div key={session.id} className="rounded-2xl border border-zinc-200 bg-[#fbfaf8] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[12px] font-medium text-zinc-500">
                          {formatShortDate(session.date)} · {normalizeSport(session.sport)}{formatDuration(session.duration) ? ` · ${formatDuration(session.duration)}` : ''}
                        </div>
                        <div className="mt-1 line-clamp-2 text-[15px] font-semibold leading-5 text-zinc-950">{cleanTitle(session.title)}</div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-zinc-200 bg-[#fbfaf8] p-3 text-sm text-zinc-500">
                  Your sessions are in the calendar. Open the schedule to start from the next upcoming workout.
                </div>
              )}
            </div>
          </section>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <button type="button" onClick={close} className="min-h-12 rounded-2xl bg-zinc-950 px-4 text-sm font-semibold text-white">
              Go to schedule
            </button>
            <button type="button" onClick={exportCalendar} className="min-h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800">
              Export calendar
            </button>
            <button type="button" onClick={askCoach} className="min-h-12 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800">
              Ask coach
            </button>
          </div>

          {loading ? <p className="mt-3 text-center text-xs text-zinc-400">Loading plan review…</p> : null}
        </div>
      </div>
    </div>
  );
}
