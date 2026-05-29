'use client';

import { useEffect, useMemo, useState } from 'react';
import { Dialog } from '@headlessui/react';
import { format, parseISO } from 'date-fns';
import clsx from 'clsx';
import { supabase } from '@/lib/supabase/client';
import type { CompletedSession, Session } from '@/types/session';
import type { StravaActivity } from '@/types/strava';
import { loadFuelingPreferences, saveFuelingPreferences } from '@/lib/fueling-preferences';
import { track } from '@/lib/analytics/posthog-client';

type Props = {
  session: Session | null;
  stravaActivity?: StravaActivity | null;
  open: boolean;
  onClose: () => void;
  completedSessions: CompletedSession[];
  onCompletedUpdate: (updated: CompletedSession[]) => void;
  onSessionDeleted?: (sessionId: string) => void;
  onSessionUpdated?: (updated: Session) => void;
  weekLabel?: string;
  weekPhase?: string | null;
  recentCompleted?: number;
  recentMissed?: number;
  raceGoal?: string | null;
};

type WorkoutSection = {
  title: string;
  items: string[];
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

function formatMovingTime(seconds?: number | null) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return null;
  return formatMinutes(seconds / 60);
}

function formatDistance(meters?: number | null) {
  if (typeof meters !== 'number' || !Number.isFinite(meters) || meters <= 0) return null;
  if (meters > 1609) return `${(meters / 1609.34).toFixed(1)} mi`;
  return `${Math.round(meters)} m`;
}

function parseWorkout(raw?: string | null): WorkoutSection[] {
  const text = String(raw ?? '').trim();
  if (!text) return [];

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const sections: WorkoutSection[] = [];
  let current: WorkoutSection | null = null;

  const headings = ['warmup', 'warm-up', 'main set', 'main', 'cooldown', 'cool-down', 'fueling', 'notes', 'workout'];

  for (const line of lines) {
    const clean = line.replace(/\*\*/g, '').replace(/[:：]$/g, '').trim();
    const lower = clean.toLowerCase();
    const isHeading = (line.endsWith(':') || line.endsWith('：') || /^\*\*.*\*\*:/.test(line)) && headings.includes(lower);

    if (/^workout\s*title\s*:/i.test(clean)) continue;

    if (isHeading) {
      current = { title: clean, items: [] };
      sections.push(current);
      continue;
    }

    if (!current) {
      current = { title: 'Workout', items: [] };
      sections.push(current);
    }

    current.items.push(line.replace(/^[-•]\s*/, '').replace(/\*\*/g, '').trim());
  }

  return sections.filter((section) => section.items.length > 0);
}

function getObjective(session: Session | null) {
  const detail = String(session?.details ?? '').trim();
  if (!detail) return 'Execute the session with steady effort and clean form.';
  return detail.split(/(?<=[.!?])\s+/)[0] || 'Execute the session with steady effort and clean form.';
}

function metricCard(label: string, value: string | null) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">{label}</div>
      <div className="mt-1 text-[14px] font-semibold text-zinc-950">{value || '—'}</div>
    </div>
  );
}

export default function SessionModal({
  session,
  stravaActivity,
  open,
  onClose,
  completedSessions,
  onCompletedUpdate,
  onSessionDeleted,
  onSessionUpdated,
  weekLabel,
  weekPhase,
  recentCompleted = 0,
  recentMissed = 0,
  raceGoal,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);
  const [output, setOutput] = useState<string | null>(session?.structured_workout ?? null);
  const [notesDraft, setNotesDraft] = useState(session?.details ?? '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [fuelingEnabled, setFuelingEnabled] = useState(false);
  const [bodyWeightKg, setBodyWeightKg] = useState('');
  const [bodyFatPct, setBodyFatPct] = useState('');
  const [sweatRateLPerHour, setSweatRateLPerHour] = useState('');

  useEffect(() => {
    setOutput(session?.structured_workout ?? null);
    setNotesDraft(session?.details ?? '');
  }, [session?.id, session?.structured_workout, session?.details]);

  useEffect(() => {
    if (!open || !session?.id) return;
    track('session_opened', {
      sport: session.sport || 'unknown',
      date: session.date || null,
      is_planned: true,
    });
  }, [open, session?.id, session?.sport, session?.date]);

  useEffect(() => {
    const defaults = loadFuelingPreferences();
    setFuelingEnabled(defaults.enabled);
    setBodyWeightKg(defaults.bodyWeightKg);
    setBodyFatPct(defaults.bodyFatPct);
    setSweatRateLPerHour(defaults.sweatRateLPerHour);
  }, [session?.id]);

  useEffect(() => {
    saveFuelingPreferences({ enabled: fuelingEnabled, bodyWeightKg, bodyFatPct, sweatRateLPerHour });
  }, [fuelingEnabled, bodyWeightKg, bodyFatPct, sweatRateLPerHour]);

  const manualStatus = useMemo<'done' | 'skipped' | null>(() => {
    const match = completedSessions.find((item) => item.date === session?.date && item.session_title === session?.title);
    if (!match) return null;
    return match.status === 'skipped' ? 'skipped' : 'done';
  }, [completedSessions, session?.date, session?.title]);

  const workoutSections = useMemo(() => parseWorkout(output), [output]);
  const isCompleted = Boolean(stravaActivity) || manualStatus === 'done';
  const isSkipped = !stravaActivity && manualStatus === 'skipped';
  const notesChanged = notesDraft !== (session?.details ?? '');

  if (!session) return null;

  const formattedDate = format(parseISO(session.date), 'EEE, MMM d, yyyy');
  const plannedDuration = formatMinutes(session.duration ?? null);
  const completedDuration = formatMovingTime(stravaActivity?.moving_time ?? null);
  const completedDistance = formatDistance(stravaActivity?.distance ?? null);
  const title = cleanTitle(session.title);

  const applyLocalStatus = (nextStatus: 'done' | 'skipped' | null) => {
    const base = completedSessions.filter((item) => item.date !== session.date || item.session_title !== session.title);
    if (!nextStatus) return base;
    return [...base, { date: session.date, session_title: session.title, status: nextStatus }];
  };

  const updateStatus = async (mode: 'done' | 'skipped') => {
    setMarking(true);
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
        window.alert(payload?.error || 'Could not update session status.');
        return;
      }

      const active = mode === 'done' ? payload?.completed === true : payload?.skipped === true;
      onCompletedUpdate(applyLocalStatus(active ? mode : null));
    } catch (error) {
      console.error(error);
      onCompletedUpdate(previous);
      window.alert('Unexpected error updating session.');
    } finally {
      setMarking(false);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
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
          fueling: {
            enabled: fuelingEnabled,
            bodyWeightKg: bodyWeightKg ? Number(bodyWeightKg) : null,
            bodyFatPct: bodyFatPct ? Number(bodyFatPct) : null,
            workoutDurationMin: typeof session.duration === 'number' ? Math.round(session.duration) : null,
            sweatRateLPerHour: sweatRateLPerHour ? Number(sweatRateLPerHour) : null,
          },
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.structured_workout) {
        window.alert(data?.error || 'Failed to generate detailed workout.');
        return;
      }

      const structured = String(data.structured_workout).trim();
      setOutput(structured);
      onSessionUpdated?.({ ...session, structured_workout: structured, details: session.details });
    } catch (error) {
      console.error(error);
      window.alert('Unexpected error generating workout.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!notesChanged) return;
    setSavingNotes(true);
    try {
      const cleanNotes = notesDraft.trim();
      const { error } = await supabase.from('sessions').update({ details: cleanNotes || null }).eq('id', session.id);
      if (error) {
        window.alert('Could not save notes.');
        return;
      }
      onSessionUpdated?.({ ...session, details: cleanNotes || null });
    } catch (error) {
      console.error(error);
      window.alert('Unexpected error saving notes.');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm('Delete this session from your calendar?');
    if (!confirmed) return;
    const { error } = await supabase.from('sessions').delete().eq('id', session.id);
    if (error) {
      window.alert('Could not delete this session.');
      return;
    }
    onSessionDeleted?.(session.id);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-zinc-950/25 backdrop-blur-sm" aria-hidden="true" />

      <div className="fixed inset-0 flex justify-end">
        <Dialog.Panel className="flex h-full w-full max-w-[480px] flex-col border-l border-zinc-200 bg-[#FAFAF7] shadow-[0_30px_100px_rgba(15,23,42,0.28)]">
          <div className="border-b border-zinc-200 bg-white px-6 py-5">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">Planned</span>
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700">{normalizeSport(session.sport)}</span>
                  {isCompleted ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">Completed</span> : null}
                  {isSkipped ? <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">Skipped</span> : null}
                </div>
                <Dialog.Title className="text-[24px] font-semibold leading-tight tracking-tight text-zinc-950">{title}</Dialog.Title>
                <div className="mt-2 text-[13px] text-zinc-500">{formattedDate}</div>
              </div>

              <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50">
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {metricCard('Planned', plannedDuration)}
              {metricCard('Completed', completedDuration ?? completedDistance)}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <section className="rounded-3xl border border-zinc-200 bg-white p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Objective</div>
              <p className="mt-2 text-[14px] leading-6 text-zinc-700">{getObjective(session)}</p>
            </section>

            <section className="mt-4 rounded-3xl border border-zinc-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Workout</div>
                  <div className="mt-1 text-[14px] font-semibold text-zinc-950">{workoutSections.length ? 'Structured session' : 'Not generated yet'}</div>
                </div>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-3.5 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
                >
                  <SparkIcon className="h-4 w-4" />
                  {loading ? 'Generating…' : workoutSections.length ? 'Regenerate' : 'Generate'}
                </button>
              </div>

              {workoutSections.length ? (
                <div className="space-y-3">
                  {workoutSections.map((section) => (
                    <div key={section.title} className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
                      <div className="text-[13px] font-semibold text-zinc-950">{section.title}</div>
                      <ul className="mt-2 space-y-1.5 text-[13px] leading-5 text-zinc-600">
                        {section.items.map((item, index) => (
                          <li key={`${section.title}-${index}`} className="flex gap-2">
                            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-zinc-400" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-[13px] text-zinc-500">
                  Generate a detailed workout to turn this session into warm-up, main set, and cool-down steps.
                </div>
              )}
            </section>

            <section className="mt-4 rounded-3xl border border-zinc-200 bg-white p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Completion</div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => updateStatus('done')}
                  disabled={marking}
                  className={clsx('rounded-xl border px-4 py-3 text-[13px] font-semibold', isCompleted ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50')}
                >
                  {manualStatus === 'done' ? 'Mark as not done' : 'Mark done'}
                </button>
                <button
                  type="button"
                  onClick={() => updateStatus('skipped')}
                  disabled={marking || Boolean(stravaActivity)}
                  className={clsx('rounded-xl border px-4 py-3 text-[13px] font-semibold', isSkipped ? 'border-zinc-300 bg-zinc-100 text-zinc-700' : 'border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 disabled:opacity-50')}
                >
                  {isSkipped ? 'Unskip session' : 'Skip session'}
                </button>
              </div>
            </section>

            <section className="mt-4 rounded-3xl border border-zinc-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Notes</div>
                <button type="button" onClick={handleSaveNotes} disabled={!notesChanged || savingNotes} className="text-[12px] font-semibold text-zinc-950 disabled:text-zinc-300">
                  {savingNotes ? 'Saving…' : 'Save'}
                </button>
              </div>
              <textarea
                value={notesDraft}
                onChange={(event) => setNotesDraft(event.target.value)}
                placeholder="Add how you felt, what changed, or anything your coach should know."
                className="min-h-[110px] w-full resize-none rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-[13px] leading-5 text-zinc-800 outline-none focus:border-zinc-400 focus:bg-white"
              />
            </section>

            <section className="mt-4 rounded-3xl border border-zinc-200 bg-white p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">Context</div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-[13px] text-zinc-600">
                <div>Week: <span className="font-semibold text-zinc-950">{weekLabel || 'Current week'}</span></div>
                <div>Phase: <span className="font-semibold text-zinc-950">{weekPhase || 'Active'}</span></div>
                <div>Recent done: <span className="font-semibold text-zinc-950">{recentCompleted}</span></div>
                <div>Recent missed: <span className="font-semibold text-zinc-950">{recentMissed}</span></div>
              </div>
              {raceGoal ? <div className="mt-3 text-[13px] text-zinc-500">Race focus: {raceGoal}</div> : null}
            </section>

            <section className="mt-4 rounded-3xl border border-zinc-200 bg-white p-5">
              <label className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[13px] font-semibold text-zinc-950">Include fueling guidance</div>
                  <div className="mt-1 text-[12px] text-zinc-500">Optional context for long or high-intensity sessions.</div>
                </div>
                <input type="checkbox" checked={fuelingEnabled} onChange={(event) => setFuelingEnabled(event.target.checked)} className="h-4 w-4" />
              </label>

              {fuelingEnabled ? (
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <input value={bodyWeightKg} onChange={(e) => setBodyWeightKg(e.target.value)} placeholder="kg" className="rounded-xl border border-zinc-200 px-3 py-2 text-[13px]" />
                  <input value={bodyFatPct} onChange={(e) => setBodyFatPct(e.target.value)} placeholder="body fat %" className="rounded-xl border border-zinc-200 px-3 py-2 text-[13px]" />
                  <input value={sweatRateLPerHour} onChange={(e) => setSweatRateLPerHour(e.target.value)} placeholder="L/hr" className="rounded-xl border border-zinc-200 px-3 py-2 text-[13px]" />
                </div>
              ) : null}
            </section>

            <div className="mt-6 border-t border-zinc-200 pt-4">
              <button type="button" onClick={handleDelete} className="text-[13px] font-semibold text-rose-600 hover:text-rose-700">
                Delete session
              </button>
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
