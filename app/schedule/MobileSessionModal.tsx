'use client';

import { Dialog } from '@headlessui/react';
import { format, parseISO } from 'date-fns';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { supabase } from '@/lib/supabase/client';
import { track } from '@/lib/analytics/posthog-client';
import type { CompletedSession, Session } from '@/types/session';
import type { StravaActivity } from '@/types/strava';

type Props = {
  session: Session | null;
  stravaActivity?: StravaActivity | null;
  open: boolean;
  onClose: () => void;
  completedSessions: CompletedSession[];
  onCompletedUpdate: (updated: CompletedSession[]) => void;
  onSessionDeleted?: (sessionId: string) => void;
  onSessionUpdated?: (updated: Session) => void;
  weekPhase?: string | null;
  raceGoal?: string | null;
};

type DetailSection = {
  label: string;
  body: string;
};

function XIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M7 7l10 10M17 7 7 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SparkIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
      <path d="M10 2.8 11.6 8l5.4 2-5.4 2L10 17.2 8.4 12 3 10l5.4-2L10 2.8Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function normalizeSport(value?: string | null) {
  const sport = String(value ?? '').trim().toLowerCase();
  if (!sport) return 'Session';
  if (sport.includes('ride')) return 'Bike';
  return sport.charAt(0).toUpperCase() + sport.slice(1);
}

function cleanTitle(title?: string | null) {
  return String(title ?? 'Untitled session')
    .replace(/^\p{Extended_Pictographic}\s*/u, '')
    .replace(/^[\s—–-]+/, '')
    .replace(/^[\s:•·]+/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function formatMinutes(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  if (value < 60) return `${Math.round(value)} min`;
  const h = Math.floor(value / 60);
  const m = Math.round(value % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

function cleanDetails(value?: string | null) {
  return String(value ?? '')
    .replace(/\b(details\s*[—–-]\s*){2,}/gi, '')
    .replace(/\bdetails\s+details\b/gi, '')
    .split('\n')
    .map((line) => line.replace(/[ \t]{2,}/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function parseSections(value?: string | null): DetailSection[] {
  const text = cleanDetails(value);
  if (!text) return [];

  const sections = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(Purpose|Workout|Intensity|Coach note):\s*(.+)$/i);
      if (!match) return null;
      return { label: match[1].replace(/^coach note$/i, 'Coach note'), body: match[2].trim() };
    })
    .filter((item): item is DetailSection => Boolean(item));

  return sections.length ? sections : [{ label: 'Workout', body: text }];
}

function summarizeSections(sections: DetailSection[]) {
  const purpose = sections.find((section) => section.label.toLowerCase() === 'purpose')?.body;
  const workout = sections.find((section) => section.label.toLowerCase() === 'workout')?.body;
  const fallback = sections[0]?.body;
  return {
    purpose: purpose ?? fallback ?? 'Execute this session with steady effort and good form.',
    workout: workout ?? sections.find((section) => section.label.toLowerCase() === 'intensity')?.body ?? null,
  };
}

export default function MobileSessionModal({
  session,
  stravaActivity,
  open,
  onClose,
  completedSessions,
  onCompletedUpdate,
  onSessionDeleted,
  onSessionUpdated,
  weekPhase,
  raceGoal,
}: Props) {
  const router = useRouter();
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [plusRequired, setPlusRequired] = useState(false);
  const [upgradeUrl, setUpgradeUrl] = useState('/settings');
  const [output, setOutput] = useState<string | null>(session?.structured_workout ?? null);

  const manualStatus = useMemo<'done' | 'skipped' | null>(() => {
    const match = completedSessions.find((item) => item.date === session?.date && item.session_title === session?.title);
    if (!match) return null;
    return match.status === 'skipped' ? 'skipped' : 'done';
  }, [completedSessions, session?.date, session?.title]);

  if (!session) return null;

  const title = cleanTitle(session.title);
  const sport = normalizeSport(session.sport);
  const formattedDate = format(parseISO(session.date), 'EEE, MMM d');
  const plannedDuration = formatMinutes(session.duration ?? null);
  const isCompleted = Boolean(stravaActivity) || manualStatus === 'done';
  const isSkipped = !stravaActivity && manualStatus === 'skipped';
  const sections = parseSections(session.details);
  const summary = summarizeSections(sections);
  const workoutSections = parseSections(output);

  const applyLocalStatus = (nextStatus: 'done' | 'skipped' | null) => {
    const base = completedSessions.filter((item) => item.date !== session.date || item.session_title !== session.title);
    if (!nextStatus) return base;
    return [...base, { date: session.date, session_title: session.title, status: nextStatus }];
  };

  const updateStatus = async (mode: 'done' | 'skipped') => {
    setMarking(true);
    setErrorMessage(null);
    const previous = completedSessions;
    const shouldUndo = mode === 'done' ? manualStatus === 'done' : isSkipped;
    onCompletedUpdate(applyLocalStatus(shouldUndo ? null : mode));

    try {
      const { data: auth } = await supabase.auth.getUser();
      const res = await fetch(mode === 'done' ? '/api/schedule/mark-done' : '/api/schedule/mark-skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_date: session.date,
          session_title: session.title,
          undo: shouldUndo,
          clientUserId: auth.user?.id ?? null,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        onCompletedUpdate(previous);
        setErrorMessage(payload?.error || 'Could not update session status.');
        return;
      }

      const active = mode === 'done' ? payload?.completed === true : payload?.skipped === true;
      onCompletedUpdate(applyLocalStatus(active ? mode : null));
    } catch (error) {
      console.error(error);
      onCompletedUpdate(previous);
      setErrorMessage('Unexpected error updating session.');
    } finally {
      setMarking(false);
    }
  };

  const goToUpgrade = () => {
    track('plus_upgrade_clicked', { feature: 'detailed_workouts', source: 'mobile_session_modal' });
    router.push(upgradeUrl);
  };

  const handleGenerate = async () => {
    setLoading(true);
    setErrorMessage(null);
    setPlusRequired(false);

    try {
      const res = await fetch('/api/generate-detailed-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          title: session.title,
          sport: session.sport,
          date: session.date,
          details: session.details ?? '',
          fueling: { enabled: false },
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.structured_workout) {
        if (data?.code === 'PLUS_REQUIRED') {
          setPlusRequired(true);
          setUpgradeUrl(
            session.plan_id
              ? `/plan-preview/${session.plan_id}?feature=detailed-workouts`
              : typeof data?.upgradeUrl === 'string'
                ? data.upgradeUrl
                : '/settings'
          );
          track('plus_gate_viewed', { feature: 'detailed_workouts', source: 'mobile_session_modal' });
          return;
        }
        setErrorMessage(data?.error || 'Failed to generate detailed workout.');
        return;
      }

      const structured = String(data.structured_workout).trim();
      setOutput(structured);
      setShowDetails(true);
      onSessionUpdated?.({ ...session, structured_workout: structured, details: session.details });
    } catch (error) {
      console.error(error);
      setErrorMessage('Unexpected error generating workout.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm('Delete this session from your calendar?');
    if (!confirmed) return;
    const { error } = await supabase.from('sessions').delete().eq('id', session.id);
    if (error) {
      setErrorMessage('Could not delete this session.');
      return;
    }
    onSessionDeleted?.(session.id);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50 md:hidden">
      <div className="fixed inset-0 bg-zinc-950/35 backdrop-blur-[2px]" aria-hidden="true" />
      <div className="fixed inset-x-0 bottom-0 flex max-h-[92dvh] items-end justify-center px-2 pt-10">
        <Dialog.Panel className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[2rem] border border-zinc-200 bg-white shadow-[0_-24px_80px_rgba(15,23,42,0.24)]">
          <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-zinc-200" />

          <div className="border-b border-zinc-200 px-5 pb-4 pt-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[12px] font-medium text-zinc-600">{sport}</span>
                  <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[12px] font-medium text-zinc-600">{formattedDate}</span>
                  {isCompleted ? <span className="rounded-full bg-zinc-950 px-2.5 py-1 text-[12px] font-semibold text-white">Done</span> : null}
                  {isSkipped ? <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[12px] font-semibold text-zinc-600">Skipped</span> : null}
                </div>
                <Dialog.Title className="text-[30px] font-semibold leading-[0.98] tracking-[-0.055em] text-zinc-950">{title}</Dialog.Title>
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[14px] leading-5 text-zinc-500">
                  {plannedDuration ? <span>{plannedDuration}</span> : null}
                  {raceGoal ? <span>{raceGoal}</span> : null}
                  {weekPhase ? <span>{weekPhase}</span> : null}
                </div>
              </div>

              <button type="button" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-zinc-200 bg-white text-zinc-500 active:scale-[0.98]">
                <XIcon className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {errorMessage ? <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-medium text-rose-700">{errorMessage}</div> : null}

            <section className="rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Overview</div>
              <p className="mt-2 text-[15px] leading-6 text-zinc-800">{summary.purpose}</p>
              {summary.workout ? <p className="mt-3 border-t border-zinc-200 pt-3 text-[14px] leading-6 text-zinc-600">{summary.workout}</p> : null}
            </section>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={marking}
                onClick={() => updateStatus('done')}
                className={clsx('min-h-12 rounded-2xl border px-3 text-[14px] font-semibold', isCompleted ? 'border-zinc-950 bg-zinc-950 text-white' : 'border-zinc-200 bg-white text-zinc-800')}
              >
                {manualStatus === 'done' ? 'Undo done' : 'Mark done'}
              </button>
              <button
                type="button"
                disabled={marking || Boolean(stravaActivity)}
                onClick={() => updateStatus('skipped')}
                className={clsx('min-h-12 rounded-2xl border px-3 text-[14px] font-semibold disabled:opacity-50', isSkipped ? 'border-zinc-300 bg-zinc-100 text-zinc-800' : 'border-zinc-200 bg-white text-zinc-800')}
              >
                {isSkipped ? 'Unskip' : 'Skip'}
              </button>
            </div>

            <section className="mt-3 rounded-[1.5rem] border border-zinc-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Detailed workout</div>
                  <p className="mt-1 text-[14px] leading-5 text-zinc-500">Warm-up, main set, cooldown, and optional fueling.</p>
                </div>
                <span className="rounded-full bg-zinc-950 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">Plus</span>
              </div>

              {workoutSections.length && showDetails ? (
                <div className="mt-4 space-y-3">
                  {workoutSections.map((section) => (
                    <div key={section.label} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                      <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-zinc-400">{section.label}</div>
                      <p className="mt-1 text-[14px] leading-6 text-zinc-700">{section.body}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {plusRequired ? (
                <button type="button" onClick={goToUpgrade} className="mt-4 min-h-12 w-full rounded-2xl bg-zinc-950 px-4 text-[14px] font-semibold text-white">
                  Unlock Plus
                </button>
              ) : (
                <button type="button" onClick={handleGenerate} disabled={loading} className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-4 text-[14px] font-semibold text-white disabled:opacity-60">
                  <SparkIcon className="h-4 w-4" />
                  {loading ? 'Generating…' : output ? 'Regenerate details' : 'Generate details'}
                </button>
              )}
            </section>

            {sections.length > 1 ? (
              <button type="button" onClick={() => setShowDetails((value) => !value)} className="mt-3 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-[14px] font-semibold text-zinc-700">
                {showDetails ? 'Hide full plan details' : 'Show full plan details'}
              </button>
            ) : null}

            {showDetails && sections.length > 1 ? (
              <section className="mt-3 rounded-[1.5rem] border border-zinc-200 bg-white p-4">
                <div className="space-y-3">
                  {sections.map((section) => (
                    <div key={section.label} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                      <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-zinc-400">{section.label}</div>
                      <p className="mt-1 text-[14px] leading-6 text-zinc-700">{section.body}</p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <button type="button" onClick={handleDelete} className="mx-auto mt-4 block px-4 py-2 text-[13px] font-medium text-zinc-300">
              Delete session
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
