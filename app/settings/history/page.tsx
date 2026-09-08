'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { supabase } from '@/lib/supabase/client';
import { calculateReadiness } from '@/lib/readiness';

type HistoryRow = {
  id: string;
  race_type: string | null;
  race_date: string | null;
  plan: any;
  sessions: any[] | null;
  completed_sessions: any[] | null;
  archived_at: string;
};

function safeDate(value?: string | null, pattern = 'MMM d, yyyy') {
  if (!value) return 'No date';
  try {
    return format(parseISO(value), pattern);
  } catch {
    return value;
  }
}

export default function PlanHistoryPage() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user?.id) {
          if (active) setError('Sign in to view plan history.');
          return;
        }
        const { data, error: queryError } = await supabase
          .from('plan_history')
          .select('id,race_type,race_date,plan,sessions,completed_sessions,archived_at')
          .eq('user_id', auth.user.id)
          .order('archived_at', { ascending: false });
        if (queryError) throw queryError;
        if (active) setRows((data ?? []) as HistoryRow[]);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Could not load plan history.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#6B7280]">Plan history</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.05em] text-[#101114]">Your previous race builds</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6B7280]">
            Rebuilding starts a fresh readiness score, but the build you completed is kept here with the sessions and score it had when it was replaced.
          </p>
        </div>
        <Link href="/plan" className="w-fit rounded-full bg-[#101114] px-4 py-2 text-sm font-black text-white">
          Build a new plan
        </Link>
      </div>

      {loading ? <p className="mt-10 text-sm text-[#6B7280]">Loading history…</p> : null}
      {error ? <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div> : null}

      {!loading && !error && rows.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-[#E3E0D8] bg-white p-6">
          <h2 className="font-black text-[#101114]">No archived builds yet</h2>
          <p className="mt-2 text-sm leading-6 text-[#6B7280]">Your current plan stays active until you intentionally rebuild it. When you do, the previous build will appear here.</p>
        </div>
      ) : null}

      <div className="mt-8 grid gap-4">
        {rows.map((row) => {
          const archivedAt = parseISO(row.archived_at);
          const readiness = calculateReadiness({
            sessions: Array.isArray(row.sessions) ? row.sessions : [],
            completedSessions: Array.isArray(row.completed_sessions) ? row.completed_sessions : [],
            raceDate: row.race_date,
            now: archivedAt,
          });
          const params = row.plan?.params ?? {};
          const raceName = String(params.raceName ?? '').trim();
          return (
            <article key={row.id} className="rounded-3xl border border-[#E3E0D8] bg-white p-6 shadow-[0_12px_40px_rgba(16,17,20,0.04)]">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6B7280]">Archived {safeDate(row.archived_at)}</p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#101114]">{raceName || row.race_type || 'Previous race build'}</h2>
                  <p className="mt-1 text-sm text-[#6B7280]">Race date {safeDate(row.race_date)}</p>
                </div>
                <div className="rounded-2xl bg-[#F7F6F2] px-5 py-4 text-right">
                  <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#6B7280]">Final readiness</p>
                  <p className="mt-1 text-3xl font-black tracking-[-0.06em] text-[#101114]">{readiness.score}<span className="text-base text-[#9CA3AF]">/100</span></p>
                  <p className="text-xs font-bold text-[#6B7280]">{readiness.label}</p>
                </div>
              </div>
              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                <div className="rounded-2xl border border-[#E3E0D8] p-4"><p className="text-xs font-bold text-[#6B7280]">Planned sessions</p><p className="mt-1 text-xl font-black">{Array.isArray(row.sessions) ? row.sessions.length : 0}</p></div>
                <div className="rounded-2xl border border-[#E3E0D8] p-4"><p className="text-xs font-bold text-[#6B7280]">Completed records</p><p className="mt-1 text-xl font-black">{Array.isArray(row.completed_sessions) ? row.completed_sessions.length : 0}</p></div>
                <div className="rounded-2xl border border-[#E3E0D8] p-4"><p className="text-xs font-bold text-[#6B7280]">Build score</p><p className="mt-1 text-xl font-black">Finished at {readiness.score}</p></div>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
