'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog } from '@headlessui/react';
import { format, parseISO } from 'date-fns';
import clsx from 'clsx';
import { supabase } from '@/lib/supabase-client';
import type { Session } from '@/types/session';
import type { StravaActivity } from '@/types/strava';
import {
  loadFuelingPreferences,
  saveFuelingPreferences,
} from '@/lib/fueling-preferences';
import { track } from '@/lib/analytics/posthog-client';
import { buildCoachingHref } from '@/lib/coaching/context';

type CompletedSession = {
  date: string;
  session_title: string;
  strava_id?: string;
  status?: 'done' | 'skipped';
};

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

function useIsMobile(breakpointPx = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, [breakpointPx]);

  return isMobile;
}

function toStravaIdString(
  session: Session | null,
  stravaActivity?: StravaActivity | null
): string | undefined {
  const fromActivity = (stravaActivity as any)?.strava_id ?? (stravaActivity as any)?.id;
  if (fromActivity != null) return String(fromActivity);

  const fromSession = (session as any)?.strava_id;
  if (fromSession != null && String(fromSession).trim() !== '') return String(fromSession);

  return undefined;
}

/**
 * Turn "ChatGPT-shaped" structured_workout into a strict UI schema.
 * Supports either:
 *  - Section headings like "Warmup:" / "Main Set:" / "Cooldown:"
 *  - Markdown-ish "**Warmup:**"
 *  - Bullets "- " or "• "
 */
function parseWorkout(raw: string | null): Array<{ title: string; items: string[] }> {
  const text = (raw ?? '').trim();
  if (!text) return [];

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const sections: Array<{ title: string; items: string[] }> = [];
  let current: { title: string; items: string[] } | null = null;

  const cleanHeading = (s: string) =>
    s
      .replace(/^\*\*/g, '')
      .replace(/\*\*$/g, '')
      .replace(/[:：]\s*$/g, '')
      .trim();

  const isHeading = (l: string) => {
    // Examples:
    // "Warmup:" , "**Warmup:**", "Main Set:", "Cooldown:", "Notes:"
    const t = l.replace(/\*\*/g, '').trim().toLowerCase();
    if (t.endsWith(':') || t.endsWith('：')) {
      const base = t.replace(/[:：]$/g, '');
      return [
        'warmup',
        'main set',
        'cooldown',
        'notes',
        'optional',
        'recovery',
        'drills',
        'fueling',
      ].includes(base);
    }
    return false;
  };

  const normalizeBullet = (l: string) => l.replace(/^[-•]\s*/, '').trim();

  for (const line of lines) {
    if (isHeading(line)) {
      const title = cleanHeading(line);
      current = { title, items: [] };
      sections.push(current);
      continue;
    }

    const isBullet = /^[-•]\s+/.test(line);
    if (!current) {
      // Create a default section if the model didn't provide headings.
      current = { title: 'Workout', items: [] };
      sections.push(current);
    }

    if (isBullet) {
      current.items.push(normalizeBullet(line));
    } else {
      // Treat non-bullets as a bullet item to enforce consistent UI.
      current.items.push(line.replace(/\*\*/g, '').trim());
    }
  }

  // Strip "Workout Title:" lines into the header (don’t show inside body)
  const filtered = sections.map((s) => ({
    ...s,
    items: s.items.filter((it) => !/^workout title/i.test(it)),
  }));

  // Remove empty sections
  return filtered.filter((s) => s.items.length > 0);
}

function XIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M7 7l10 10M17 7L7 17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function getSportTheme(sportRaw?: string | null) {
  const sport = String(sportRaw ?? '')
    .trim()
    .toLowerCase();

  switch (sport) {
    case 'swim':
      return {
        gradient: 'from-slate-600/90 to-sky-500/80',
        softBg: 'bg-slate-50',
        softBorder: 'border-slate-200',
      };
    case 'bike':
      return {
        gradient: 'from-zinc-700/90 to-zinc-500/80',
        softBg: 'bg-zinc-50',
        softBorder: 'border-zinc-200',
      };
    case 'run':
      return {
        gradient: 'from-emerald-700/90 to-teal-500/80',
        softBg: 'bg-emerald-50/60',
        softBorder: 'border-emerald-200',
      };
    case 'strength':
      return {
        gradient: 'from-violet-700/90 to-fuchsia-500/75',
        softBg: 'bg-violet-50/60',
        softBorder: 'border-violet-200',
      };
    case 'rest':
      return {
        gradient: 'from-zinc-500/90 to-zinc-400/80',
        softBg: 'bg-zinc-50',
        softBorder: 'border-zinc-200',
      };
    default:
      return {
        gradient: 'from-zinc-700/90 to-slate-500/80',
        softBg: 'bg-zinc-50',
        softBorder: 'border-zinc-200',
      };
  }
}

function formatSportLabel(sportRaw?: string | null) {
  const sport = String(sportRaw ?? '').trim().toLowerCase();
  if (!sport) return '—';
  return sport.charAt(0).toUpperCase() + sport.slice(1);
}

function cleanSessionTitle(title?: string | null) {
  return String(title ?? '')
    .replace(/\s+[—–-]\s+/g, ' ')
    .replace(/[—–]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function extractPlannedMetrics(session: Session | null): { plannedDuration: string | null; plannedDistance: string | null } {
  if (!session) return { plannedDuration: null, plannedDistance: null };

  const combined = `${session.title ?? ''} ${session.details ?? ''} ${session.structured_workout ?? ''}`;

  const durationFromField =
    typeof session.duration === 'number' && Number.isFinite(session.duration)
      ? `${Math.round(session.duration)} min`
      : null;

  const durationMatch =
    combined.match(/\b(\d+(?:\.\d+)?)\s*(min|mins|minute|minutes)\b/i) ||
    combined.match(/\b(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)\b/i);

  const distanceMatch = combined.match(
    /\b(\d+(?:\.\d+)?)\s*(km|kilometer|kilometers|kilometre|kilometres|mi|mile|miles|m)\b/i
  );

  return {
    plannedDuration: durationFromField ?? (durationMatch ? durationMatch[0] : null),
    plannedDistance: distanceMatch ? distanceMatch[0] : null,
  };
}

function extractObjective(session: Session | null) {
  if (!session) return 'Execute with steady effort and clean form.';
  const detail = String(session.details ?? '').trim();
  if (!detail) return 'Execute with steady effort and clean form.';
  const firstSentence = detail.split(/(?<=[.!?])\s+/)[0]?.trim();
  return firstSentence || 'Execute with steady effort and clean form.';
}

function extractWorkoutTitle(raw: string | null) {
  const lines = String(raw ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const explicit = lines.find((l) => /^workout\s*title\s*:/i.test(l));
  if (explicit) return explicit.replace(/^workout\s*title\s*:/i, '').trim();
  return null;
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
  const isMobile = useIsMobile(768);

  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<string | null>(session?.structured_workout || null);
  const [markingComplete, setMarkingComplete] = useState(false);
  const [fuelingEnabled, setFuelingEnabled] = useState(false);
  const [bodyWeightKg, setBodyWeightKg] = useState<string>('');
  const [bodyFatPct, setBodyFatPct] = useState<string>('');
  const [sweatRateLPerHour, setSweatRateLPerHour] = useState<string>('');
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const trackedSessionOpenRef = useRef<string | null>(null);

  const manualStatus = useMemo<'done' | 'skipped' | null>(() => {
    const match = completedSessions.find(
      (s) => s.date === session?.date && s.session_title === session?.title
    );
    if (!match) return null;
    return match.status === 'skipped' ? 'skipped' : 'done';
  }, [completedSessions, session?.date, session?.title]);

  const isCompleted = Boolean(stravaActivity) || manualStatus === 'done';
  const isSkipped = !stravaActivity && manualStatus === 'skipped';

  useEffect(() => {
    setOutput(session?.structured_workout || null);
    setNotesDraft(session?.details ?? '');
  }, [session?.id]);

  useEffect(() => {
    setFuelingEnabled(false);
    setBodyWeightKg('');
    setBodyFatPct('');
    setSweatRateLPerHour('');
  }, [session?.id]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !session?.id) return;
    if (trackedSessionOpenRef.current === session.id) return;

    track('session_opened', {
      sport: session.sport || 'unknown',
      date: session.date || null,
      is_planned: Boolean((session as any)?.plan_id || session.structured_workout || session.title),
    });

    trackedSessionOpenRef.current = session.id;
  }, [open, session?.id, session?.sport, session?.date, stravaActivity]);

  const notesChanged = notesDraft !== (session?.details ?? '');

  const handleApplyMood = (mood: string) => {
    const current = notesDraft.trim();
    const moodLine = `Mood: ${mood}`;
    if (!current) {
      setNotesDraft(`${moodLine}\n`);
      return;
    }

    const lines = notesDraft.split('\n');
    if (/^mood\s*:/i.test(lines[0] ?? '')) {
      lines[0] = moodLine;
      setNotesDraft(lines.join('\n'));
      return;
    }

    setNotesDraft(`${moodLine}\n${notesDraft}`);
  };

  const handleSaveNotes = async () => {
    if (!session || !notesChanged) return;
    setSavingNotes(true);

    try {
      const cleanNotes = notesDraft.trim();
      const { error } = await supabase
        .from('sessions')
        .update({ details: cleanNotes ? cleanNotes : null })
        .eq('id', session.id);

      if (error) {
        console.error('Failed to save session notes:', error);
        alert('Could not save notes. Please try again.');
        return;
      }

      onSessionUpdated?.({
        ...session,
        details: cleanNotes ? cleanNotes : null,
      });
    } catch (err) {
      console.error(err);
      alert('Unexpected error saving notes.');
    } finally {
      setSavingNotes(false);
    }
  };

  useEffect(() => {
    const defaults = loadFuelingPreferences();
    setFuelingEnabled(defaults.enabled);
    setBodyWeightKg(defaults.bodyWeightKg);
    setBodyFatPct(defaults.bodyFatPct);
    setSweatRateLPerHour(defaults.sweatRateLPerHour);
  }, [session?.id]);

  useEffect(() => {
    saveFuelingPreferences({
      enabled: fuelingEnabled,
      bodyWeightKg,
      bodyFatPct,
      sweatRateLPerHour,
    });
  }, [fuelingEnabled, bodyWeightKg, bodyFatPct, sweatRateLPerHour]);

  const parsedWorkout = useMemo(() => {
    const sections = parseWorkout(output);
    const rank = (title: string) => {
      const t = title.toLowerCase();
      if (t.includes('warm')) return 1;
      if (t.includes('main')) return 2;
      if (t.includes('cool')) return 3;
      return 10;
    };
    const preferred = sections.filter((s) => {
      const t = s.title.toLowerCase();
      return t.includes('warm') || t.includes('main') || t.includes('cool');
    });
    const base = preferred.length ? preferred : sections;
    return [...base].sort((a, b) => rank(a.title) - rank(b.title));
  }, [output]);

  const isUserCreatedSession = useMemo(() => {
    if (!session) return false;

    const hasStructuredData = Boolean(session.structured_workout || session.details);
    const hasStravaLink = Boolean(session.strava_id || stravaActivity);
    const sportValue = String((session as any).sport ?? '')
      .trim()
      .toLowerCase();
    const looksLikeManualTitle = /^session\s/i.test(session.title || '');

    return (
      !hasStructuredData &&
      !hasStravaLink &&
      (sportValue === '' || sportValue === 'other' || looksLikeManualTitle)
    );
  }, [session, stravaActivity]);

  const handleGenerate = async () => {
    if (!session) return;
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
            workoutDurationMin:
              typeof session.duration === 'number' && Number.isFinite(session.duration)
                ? Math.round(session.duration)
                : null,
            sweatRateLPerHour: sweatRateLPerHour ? Number(sweatRateLPerHour) : null,
          },
        }),
      });

      const data = (await res.json().catch(() => ({}))) as any;

      if (!res.ok) {
        console.error('Generate detailed failed:', data);
        alert(data?.error || 'Failed to generate detailed workout.');
        return;
      }

      const structured = (data?.structured_workout ?? '').trim();
      if (!structured) {
        console.error('Generate detailed returned empty structured_workout:', data);
        alert('No workout details returned.');
        return;
      }

      setOutput(structured);
    } catch (err) {
      console.error(err);
      alert('Unexpected error generating workout.');
    } finally {
      setLoading(false);
    }
  };


  const handleDeleteSession = async () => {
    if (!session || !isUserCreatedSession) return;

    const confirmed = window.confirm('Delete this session from your calendar?');
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('sessions').delete().eq('id', session.id);

      if (error) {
        console.error('Failed to delete session:', error);
        alert('Failed to delete session. Please try again.');
        return;
      }

      onSessionDeleted?.(session.id);
      onClose();
    } catch (err) {
      console.error(err);
      alert('Unexpected error deleting session.');
    }
  };

  const applyLocalStatus = (nextStatus: 'done' | 'skipped' | null) => {
    if (!session) return completedSessions;

    const base = completedSessions.filter(
      (s) => s.date !== session.date || s.session_title !== session.title
    );

    if (!nextStatus) return base;

    return [
      ...base,
      {
        date: session.date,
        session_title: session.title,
        strava_id: toStravaIdString(session, stravaActivity),
        status: nextStatus,
      },
    ];
  };

  const updateStatus = async (mode: 'done' | 'skipped') => {
    if (!session) return;
    setMarkingComplete(true);

    const previousList = completedSessions;
    const shouldUndo = mode === 'done' ? manualStatus === 'done' : isSkipped;
    onCompletedUpdate(applyLocalStatus(shouldUndo ? null : mode));

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const endpoint = mode === 'done' ? '/api/schedule/mark-done' : '/api/schedule/mark-skip';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_date: session.date,
          session_title: session.title,
          undo: shouldUndo,
          clientUserId: user?.id ?? null,
        }),
      });

      const payload = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        onCompletedUpdate(previousList);
        const msg = payload?.error || 'Failed to update session status.';
        console.error('Failed to update session status:', msg);
        alert(msg);
        return;
      }

      const serverActive = mode === 'done' ? payload?.completed === true : payload?.skipped === true;
      onCompletedUpdate(applyLocalStatus(serverActive ? mode : null));
    } catch (err) {
      onCompletedUpdate(previousList);
      console.error(err);
      alert('Unexpected error updating session.');
    } finally {
      setMarkingComplete(false);
    }
  };

  const handleMarkAsDone = async () => updateStatus('done');
  const handleMarkAsSkipped = async () => updateStatus('skipped');

  if (!session) return null;

  const formattedDate = format(parseISO(session.date), 'EEE, MMM d');
  const sportTheme = getSportTheme(session.sport);
  const { plannedDuration, plannedDistance } = extractPlannedMetrics(session);
  const sportLabel = formatSportLabel(session.sport);
  const objective = extractObjective(session);
  const workoutTitle = extractWorkoutTitle(output) ?? cleanSessionTitle(session.title);
  const doneLockedByStrava = Boolean(stravaActivity) && manualStatus !== 'done';

  const panelClass = isMobile
    ? 'w-full max-w-none rounded-t-3xl border border-black/10 bg-white shadow-[0_30px_80px_rgba(0,0,0,0.4)] h-[85vh] max-h-[85vh] overflow-hidden'
    : 'w-full max-w-3xl rounded-3xl border border-black/10 bg-white shadow-[0_35px_100px_rgba(0,0,0,0.38)] h-[85vh] max-h-[85vh] overflow-hidden';

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/35 backdrop-blur-sm" aria-hidden="true" />

      <div
        className={clsx(
          'fixed inset-0 flex',
          isMobile ? 'items-end justify-center' : 'items-center justify-center'
        )}
      >
        <Dialog.Panel
          className={panelClass}
          style={isMobile ? { paddingBottom: 'env(safe-area-inset-bottom)' } : undefined}
        >
          {isMobile && (
            <div className="pt-3 pb-2 flex justify-center">
              <div className="h-1 w-10 rounded-full bg-black/10" />
            </div>
          )}

          <div className={clsx(isMobile ? 'px-5 pb-5' : 'p-7', 'h-full min-h-0 flex flex-col')}>
            <div className={clsx('h-full min-h-0 rounded-2xl border bg-gradient-to-b from-white/70 via-white/40 to-white/20', sportTheme.softBorder, 'flex flex-col')}>
            {/* Header */}
            <div
              className={clsx(
                'sticky top-0 z-20 border-b px-4 py-4 sm:px-5 sm:py-5 text-white',
                'bg-gradient-to-r',
                sportTheme.gradient,
                sportTheme.softBorder
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Dialog.Title className="text-[22px] font-semibold tracking-tight text-white">
                    {cleanSessionTitle(session.title)}
                  </Dialog.Title>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-white/90">
                    <span className="rounded-full border border-white/30 bg-white/10 px-2.5 py-1 font-semibold">
                      {formattedDate}
                    </span>
                    <span className="rounded-full border border-white/30 bg-white/10 px-2.5 py-1 font-semibold capitalize">
                      {formatSportLabel(session.sport)}
                    </span>
                    {isCompleted && (
                      <span className="rounded-full border border-white/35 bg-white/15 px-2.5 py-1 font-semibold">
                        ✓ Completed
                      </span>
                    )}
                    {isSkipped && (
                      <span className="rounded-full border border-white/35 bg-white/15 px-2.5 py-1 font-semibold">
                        Skipped
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="shrink-0 rounded-full border border-white/25 bg-white/10 p-2 text-white/90 hover:bg-white/20"
                  aria-label="Close"
                >
                  <XIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <QuickStat label="Sport" value={sportLabel} />
                <QuickStat label="Planned duration" value={plannedDuration ?? '—'} />
                <QuickStat
                  label="Planned distance"
                  value={plannedDistance ?? '—'}
                />
                <QuickStat
                  label="Completed"
                  value={
                    stravaActivity?.moving_time != null
                      ? `${Math.floor(stravaActivity.moving_time / 60)}m`
                      : '—'
                  }
                />
              </div>
            </div>

            {/* Body */}
            <div
              className="min-h-0 max-h-full flex-1 overflow-y-scroll overscroll-contain px-3 py-3 sm:px-4"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <div className={clsx('rounded-2xl border bg-white p-4', sportTheme.softBorder)}>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Objective</div>
                <div className="mt-1 text-[15px] font-medium leading-relaxed text-zinc-900">{objective}</div>
              </div>

              <div className={clsx('mt-4 rounded-2xl border bg-white p-4', sportTheme.softBorder)}>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Completion</div>
                <div className={clsx(isMobile ? 'mt-3 grid gap-2' : 'mt-3 grid grid-cols-2 gap-2')}>
                  <button
                    onClick={handleMarkAsDone}
                    disabled={markingComplete || doneLockedByStrava}
                    className={clsx(
                      'rounded-xl border text-[14px] font-semibold px-4 py-3 active:translate-y-[0.5px] disabled:opacity-60',
                      isCompleted ? 'border-black/10 bg-black/[0.03] text-zinc-900' : 'border-black/10 bg-white text-zinc-900'
                    )}
                  >
                    {markingComplete ? 'Saving…' : doneLockedByStrava ? 'Completed via Strava' : isCompleted ? 'Mark as not done' : 'Mark as Done'}
                  </button>
                  <button
                    onClick={handleMarkAsSkipped}
                    disabled={markingComplete || doneLockedByStrava}
                    className={clsx(
                      'rounded-xl border text-[14px] font-semibold px-4 py-3 active:translate-y-[0.5px] disabled:opacity-60',
                      isSkipped ? 'border-black/10 bg-black/[0.03] text-zinc-900' : 'border-black/10 bg-white text-zinc-900'
                    )}
                  >
                    {markingComplete ? 'Saving…' : isSkipped ? 'Unskip Session' : 'Skip Session'}
                  </button>
                </div>
              </div>

              <div className={clsx('mt-4 rounded-2xl border bg-white p-4', sportTheme.softBorder)}>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Detailed workout</div>
                    <div className="mt-1 text-[13px] text-zinc-600">Generate clear execution steps for this session.</div>
                  </div>
                  <button
                    onClick={handleGenerate}
                    disabled={loading}
                    className={clsx('rounded-xl bg-gradient-to-r text-white text-[14px] font-semibold px-4 py-2.5 disabled:opacity-60 active:translate-y-[0.5px]', sportTheme.gradient)}
                  >
                    {loading ? 'Generating…' : parsedWorkout.length ? 'Generate Detailed Workout' : 'Generate Detailed Workout'}
                  </button>
                </div>
              </div>

              {/* Workout */}
              <div className={clsx('mt-4 rounded-2xl border backdrop-blur-sm', sportTheme.softBorder, sportTheme.softBg)}>
                <div className={clsx('px-4 pt-4 pb-3 border-b', sportTheme.softBorder, sportTheme.softBg)}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[12px] font-semibold tracking-wide text-zinc-500 uppercase">
                      Workout
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      {parsedWorkout.length ? 'Saved to this session' : 'Not generated yet'}
                    </div>
                  </div>
                </div>

                <div className="px-4 py-4 min-h-[220px]">
                  <div className="mb-3 text-[15px] font-semibold text-zinc-900">{workoutTitle}</div>
                  {loading ? (
                    <div className="space-y-3">
                      <div className="h-4 w-40 rounded bg-black/[0.06]" />
                      <div className="h-3 w-full rounded bg-black/[0.05]" />
                      <div className="h-3 w-5/6 rounded bg-black/[0.05]" />
                      <div className="h-3 w-2/3 rounded bg-black/[0.05]" />
                    </div>
                  ) : parsedWorkout.length ? (
                    <div className="space-y-4">
                      {parsedWorkout.map((sec) => (
                        <div key={sec.title} className="rounded-xl border border-black/5 bg-zinc-50/60 p-3">
                          <div className="text-[14px] font-semibold text-zinc-950">
                            {sec.title}
                          </div>
                          <ul className="mt-2 space-y-2">
                            {sec.items.map((it, idx) => (
                              <li key={idx} className="flex gap-2">
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-500" />
                                <span className="text-[14px] leading-relaxed text-zinc-800">
                                  {it}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl bg-white/40 p-4">
                      <div className="text-[14px] font-semibold text-zinc-900">
                        No detailed workout yet
                      </div>
                      <div className="mt-1 text-[13px] text-zinc-600">
                        Generate a structured version you can execute today.
                      </div>
                    </div>
                  )}

                  {session.details ? (
                    <div className={clsx('mt-4 rounded-xl border p-3', sportTheme.softBorder, sportTheme.softBg)}>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                        Session notes
                      </div>
                      <div className="mt-1 text-[13px] leading-relaxed text-zinc-700">{session.details}</div>
                    </div>
                  ) : null}
                  <div className={clsx('mt-4 rounded-xl border p-3', sportTheme.softBorder, sportTheme.softBg)}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                        How did it feel?
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {['Happy', 'Okay', 'Tired', 'Hard'].map((mood) => (
                          <button
                            key={mood}
                            type="button"
                            onClick={() => handleApplyMood(mood)}
                            className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-100"
                          >
                            {mood}
                          </button>
                        ))}
                      </div>
                    </div>

                    <textarea
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      rows={4}
                      placeholder="Add your notes about this session..."
                      className="mt-2 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] text-zinc-800 outline-none ring-0 placeholder:text-zinc-400 focus:border-zinc-400"
                    />

                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={handleSaveNotes}
                        disabled={!notesChanged || savingNotes}
                        className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-[12px] font-semibold text-zinc-800 disabled:opacity-50"
                      >
                        {savingNotes ? 'Saving…' : 'Save notes'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Metrics */}
              {stravaActivity && (
                <div className={clsx('mt-4 rounded-2xl border backdrop-blur-sm', sportTheme.softBorder, sportTheme.softBg)}>
                  <div className="px-4 pt-4 pb-3 border-b border-black/5">
                    <div className="text-[12px] font-semibold tracking-wide text-zinc-500 uppercase">
                      Completed
                    </div>
                  </div>

                  <div className="px-4 py-4 grid grid-cols-2 gap-4">
                    {(stravaActivity as any)?.start_date_local && (
                      <Metric
                        label="Completed at"
                        value={format(new Date((stravaActivity as any).start_date_local), 'MMM d, h:mm a')}
                      />
                    )}
                    {stravaActivity.distance != null && (
                      <Metric
                        label="Distance"
                        value={`${(stravaActivity.distance / 1000).toFixed(1)} km`}
                      />
                    )}
                    {stravaActivity.moving_time != null && stravaActivity.distance != null && (
                      <Metric
                        label="Avg pace"
                        value={`${formatPace(stravaActivity.distance, stravaActivity.moving_time)} /km`}
                      />
                    )}
                    {stravaActivity.average_heartrate != null && (
                      <Metric
                        label="Heart rate"
                        value={`${Math.round(stravaActivity.average_heartrate)} bpm`}
                      />
                    )}
                    {stravaActivity.average_watts != null && (
                      <Metric label="Power" value={`${Math.round(stravaActivity.average_watts)} w`} />
                    )}
                  </div>
                </div>
              )}

              <div className={clsx('mt-4 rounded-2xl border bg-white p-4', sportTheme.softBorder)}>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Coaching actions</div>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {[
                    'Explain This Workout',
                    'How Hard Should This Feel?',
                    'I Missed This Session — What Should I Do?',
                    'Can I Move This Workout?',
                    'What Should I Focus on This Week?',
                  ].map((label) => {
                    const href = buildCoachingHref(label, {
                      source: 'session',
                      sessionId: session.id,
                      sessionTitle: session.title,
                      sessionType: session.sport ?? null,
                      sessionDate: session.date,
                      weekLabel: weekLabel ?? null,
                      weekPhase: weekPhase ?? null,
                      completionState: isCompleted ? 'done' : isSkipped ? 'skipped' : 'planned',
                      recentCompleted,
                      recentMissed,
                      raceGoal,
                    });
                    return (
                      <a
                        key={label}
                        href={href}
                        className="rounded-lg border border-black/10 bg-white px-3 py-2 text-[13px] font-medium text-zinc-800 hover:bg-zinc-50"
                      >
                        {label}
                      </a>
                    );
                  })}
                </div>
              </div>

              {/* Footer */}
            <div className={clsx('mt-4 border-t pt-4 pb-3 px-1 sm:px-0', sportTheme.softBorder, sportTheme.softBg)}>
              <div className={clsx('mb-4 rounded-xl border p-4', sportTheme.softBorder, sportTheme.softBg)}>
                <label className="flex items-center gap-3 text-[14px] text-zinc-800">
                  <input
                    type="checkbox"
                    checked={fuelingEnabled}
                    onChange={(e) => setFuelingEnabled(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Add fueling guidance to this workout
                </label>

                {fuelingEnabled ? (
                  <>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-[12px] text-zinc-600">Body weight (kg)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={bodyWeightKg}
                          onChange={(e) => setBodyWeightKg(e.target.value)}
                          className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[14px]"
                          placeholder="70"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-[12px] text-zinc-600">Body fat % (optional)</label>
                        <input
                          type="number"
                          min="0"
                          max="60"
                          step="0.1"
                          value={bodyFatPct}
                          onChange={(e) => setBodyFatPct(e.target.value)}
                          className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[14px]"
                          placeholder="18"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-[12px] text-zinc-600">Sweat rate L/hr (optional)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={sweatRateLPerHour}
                          onChange={(e) => setSweatRateLPerHour(e.target.value)}
                          className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-[14px]"
                          placeholder="0.8"
                        />
                      </div>
                    </div>

                    <a
                      href="/fueling"
                      className="mt-3 inline-flex text-[12px] font-medium text-zinc-600 underline underline-offset-2 hover:text-zinc-900"
                    >
                      Open fueling shop guide
                    </a>
                  </>
                ) : null}
              </div>

              <div className={clsx(isMobile ? 'grid gap-3' : 'flex items-center gap-3')}>
                {isUserCreatedSession ? (
                  <button
                    onClick={handleDeleteSession}
                    className="w-full rounded-xl border border-black/10 bg-zinc-100 text-zinc-700 text-[14px] font-semibold px-4 py-3 active:translate-y-[0.5px]"
                  >
                    Delete session
                  </button>
                ) : null}
              </div>
            </div>
            </div>
          </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] tracking-wide text-zinc-500 uppercase mb-1">{label}</p>
      <p className="text-[16px] font-semibold text-zinc-950">{value}</p>
    </div>
  );
}

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/25 bg-white/10 px-2.5 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-white/75">{label}</div>
      <div className="mt-0.5 text-[13px] font-semibold text-white">{value}</div>
    </div>
  );
}

function formatPace(distanceMeters: number, timeSeconds: number) {
  const paceSecPerKm = timeSeconds / (distanceMeters / 1000);
  const minutes = Math.floor(paceSecPerKm / 60);
  const seconds = Math.round(paceSecPerKm % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
