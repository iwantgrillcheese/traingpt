// /app/components/CoachUpdateCard.tsx
//
// The visible half of the adaptive loop. Two jobs, one quiet card above the
// calendar:
//
//   1. While a fresh plan is being detailed (Batch 1's progressive
//      enrichment), show living progress: "Detailing your plan — week 4 of 16".
//   2. After the Sunday adaptation cron runs (Batch 4), show what the coach
//      changed and why, with the structured diff one tap away.
//
// Renders nothing when there's nothing to say.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type AdaptationChange = {
  date: string;
  sport: string;
  title: string;
  change: string;
  from: string;
  to: string;
  reason: string;
};

type AdaptationRow = {
  id: string;
  summary: string | null;
  changes: AdaptationChange[] | null;
  compliance: number | null;
  week_start: string | null;
  created_at: string;
};

type EnrichmentProgress = {
  weekIndex: number;
  totalWeeks: number;
};

const SHOW_ADAPTATION_FOR_DAYS = 8;

function formatWeekStart(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
}

export default function CoachUpdateCard() {
  const [adaptation, setAdaptation] = useState<AdaptationRow | null>(null);
  const [enriching, setEnriching] = useState<EnrichmentProgress | null>(null);
  const [expanded, setExpanded] = useState(false);

  const loadAdaptation = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user?.id) return;

      const since = new Date(Date.now() - SHOW_ADAPTATION_FOR_DAYS * 24 * 60 * 60 * 1000).toISOString();

      const { data } = await supabase
        .from('plan_adaptations')
        .select('id, summary, changes, compliance, week_start, created_at')
        .eq('user_id', session.user.id)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1);

      setAdaptation((data?.[0] as AdaptationRow | undefined) ?? null);
    } catch {
      // Quietly absent is the correct failure mode for an ambient card.
    }
  }, []);

  useEffect(() => {
    void loadAdaptation();
  }, [loadAdaptation]);

  // Live enrichment progress from Batch 1's runner (fires across navigation).
  useEffect(() => {
    const onWeekEnriched = (event: Event) => {
      const detail = (event as CustomEvent).detail as { weekIndex?: number; totalWeeks?: number } | undefined;
      if (typeof detail?.weekIndex === 'number' && typeof detail?.totalWeeks === 'number') {
        setEnriching({ weekIndex: detail.weekIndex + 1, totalWeeks: detail.totalWeeks });
      }
    };
    const onComplete = () => setEnriching(null);

    window.addEventListener('traingpt:week-enriched', onWeekEnriched);
    window.addEventListener('traingpt:enrichment-complete', onComplete);
    return () => {
      window.removeEventListener('traingpt:week-enriched', onWeekEnriched);
      window.removeEventListener('traingpt:enrichment-complete', onComplete);
    };
  }, []);

  const changes = useMemo(
    () => (Array.isArray(adaptation?.changes) ? adaptation!.changes! : []),
    [adaptation]
  );

  if (!enriching && !adaptation?.summary) return null;

  return (
    <section className="mb-4 rounded-[1.5rem] border border-zinc-200 bg-white p-4 sm:p-5">
      {enriching ? (
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-zinc-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-zinc-950" />
          </span>
          <p className="text-sm text-zinc-700">
            <span className="font-semibold text-zinc-950">Detailing your plan</span>
            {' — week '}
            {enriching.weekIndex} of {enriching.totalWeeks}. Your schedule is ready to use now; sessions get sharper as the coach works through each week.
          </p>
        </div>
      ) : null}

      {!enriching && adaptation?.summary ? (
        <div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
              Coach update{formatWeekStart(adaptation.week_start) ? ` · week of ${formatWeekStart(adaptation.week_start)}` : ''}
            </span>
            {changes.length ? (
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
              >
                {expanded ? 'Hide changes' : `${changes.length} change${changes.length === 1 ? '' : 's'}`}
              </button>
            ) : null}
          </div>

          <p className="mt-2 text-sm leading-6 text-zinc-800">{adaptation.summary}</p>

          {expanded && changes.length ? (
            <ul className="mt-3 space-y-2 border-t border-zinc-100 pt-3">
              {changes.map((change, index) => (
                <li key={index} className="text-sm text-zinc-700">
                  <span className="font-semibold text-zinc-950">
                    {change.change === 'downgraded_intensity' ? change.from : change.title}
                  </span>
                  <span className="text-zinc-400">{' · '}</span>
                  <span>
                    {change.from} → {change.to}
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-zinc-500">{change.reason}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
