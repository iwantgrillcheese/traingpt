'use client';

import { addDays, endOfWeek, format, isAfter, isBefore, parseISO, startOfDay, startOfWeek, subDays } from 'date-fns';
import type { Session } from '@/types/session';
import type { StravaActivity } from '@/types/strava';

type CompletedRow = {
  date?: string | null;
  session_date?: string | null;
  session_title?: string | null;
  title?: string | null;
  sport?: string | null;
  duration?: number | null;
  status?: 'done' | 'skipped' | string | null;
};

type Props = {
  sessions: Session[];
  completedSessions: CompletedRow[];
  stravaActivities: StravaActivity[];
  stravaConnected: boolean;
  raceDate?: string | null;
  onAskCoach: (prompt: string) => void;
};

type SportBucket = 'Swim' | 'Bike' | 'Run' | 'Strength' | 'Other';

function safeParseDate(value?: string | null) {
  if (!value) return null;
  try {
    const parsed = parseISO(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

function isWithinRange(date: Date, start: Date, end: Date) {
  return !isBefore(date, start) && !isAfter(date, end);
}

function getCompletedDate(row: CompletedRow) {
  return row.session_date ?? row.date ?? undefined;
}

function getCompletedTitle(row: CompletedRow) {
  return row.session_title ?? row.title ?? '';
}

function estimateDurationFromTitle(title?: string | null) {
  if (!title) return 45;
  const hours = title.match(/(\d{1,3}(?:\.\d+)?)\s*(hr|hour|hours)/i);
  if (hours) {
    const parsed = Number.parseFloat(hours[1]);
    if (Number.isFinite(parsed)) return Math.round(parsed * 60);
  }
  const mins = title.match(/(\d{1,3})\s*min/i);
  if (mins) {
    const parsed = Number.parseInt(mins[1], 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 45;
}

function sessionDurationMinutes(session: Session) {
  if (typeof session.duration === 'number' && Number.isFinite(session.duration)) return Math.max(0, session.duration);
  return estimateDurationFromTitle(session.title);
}

function formatMinutes(minutes: number) {
  const rounded = Math.max(0, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  if (hours <= 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function normalizeSport(input?: string | null): SportBucket {
  const value = String(input ?? '').toLowerCase();
  if (value.includes('swim')) return 'Swim';
  if (value.includes('bike') || value.includes('ride') || value.includes('virtualride')) return 'Bike';
  if (value.includes('run')) return 'Run';
  if (value.includes('strength') || value.includes('gym')) return 'Strength';
  return 'Other';
}

function sportDotClass(sport?: string | null) {
  const normalized = normalizeSport(sport);
  if (normalized === 'Swim') return 'bg-sky-500';
  if (normalized === 'Bike') return 'bg-orange-500';
  if (normalized === 'Run') return 'bg-emerald-500';
  if (normalized === 'Strength') return 'bg-violet-500';
  return 'bg-zinc-400';
}

function getActivityDate(activity: StravaActivity) {
  return safeParseDate(activity.start_date_local || activity.start_date);
}

function calculateSessionPoints(input: { sport?: string | null; title?: string | null; durationMinutes: number }) {
  const sport = normalizeSport(input.sport);
  const title = String(input.title ?? '').toLowerCase();
  const duration = Math.max(0, input.durationMinutes);
  let points = Math.round(duration / 10) * 5;
  if (sport === 'Bike') points += Math.round(duration / 30) * 3;
  if (sport === 'Run') points += Math.round(duration / 25) * 3;
  if (sport === 'Swim') points += 8;
  if (title.includes('long')) points += 18;
  if (title.includes('brick')) points += 16;
  if (title.includes('threshold') || title.includes('interval')) points += 14;
  if (title.includes('tempo')) points += 10;
  if (title.includes('recovery') || title.includes('easy')) points -= 4;
  if (input.sport === 'Rest') return 0;
  return Math.max(10, Math.min(points, 110));
}

function sessionPriority(session: Session) {
  const title = `${session.title ?? ''} ${session.details ?? ''} ${session.purpose ?? ''}`.toLowerCase();
  const duration = sessionDurationMinutes(session);
  let score = 0;
  if (title.includes('long')) score += 8;
  if (title.includes('brick')) score += 8;
  if (title.includes('threshold')) score += 7;
  if (title.includes('tempo')) score += 6;
  if (title.includes('interval')) score += 6;
  if (title.includes('race')) score += 5;
  if (title.includes('endurance')) score += 3;
  if (duration >= 90) score += 4;
  if (duration >= 150) score += 4;
  if (session.sport === 'Rest') score -= 10;
  return score;
}

function getSessionDateLabel(session: Session) {
  const parsed = safeParseDate(session.date);
  return parsed ? format(parsed, 'EEE, MMM d') : 'Date TBD';
}

function raceCountdown(raceDate?: string | null) {
  const race = safeParseDate(raceDate);
  if (!race) return null;
  return Math.max(0, Math.ceil((startOfDay(race).getTime() - startOfDay(new Date()).getTime()) / (1000 * 60 * 60 * 24)));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export default function CoachingCommandCenter({ sessions, completedSessions, stravaActivities, stravaConnected, raceDate, onAskCoach }: Props) {
  const now = new Date();
  const today = startOfDay(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const priorWeekStart = subDays(weekStart, 7);
  const priorWeekEnd = subDays(weekEnd, 7);
  const weekLabel = `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d')}`;
  const countdown = raceCountdown(raceDate);

  const plannedThisWeek = sessions.filter((session) => {
    const date = safeParseDate(session.date);
    return date ? isWithinRange(date, weekStart, weekEnd) : false;
  });

  const completedThisWeek = completedSessions.filter((row) => {
    if (row.status === 'skipped') return false;
    const date = safeParseDate(getCompletedDate(row));
    return date ? isWithinRange(date, weekStart, weekEnd) : false;
  });

  const currentWeekActivities = stravaActivities.filter((activity) => {
    const date = getActivityDate(activity);
    return date ? isWithinRange(date, weekStart, weekEnd) : false;
  });

  const priorWeekActivities = stravaActivities.filter((activity) => {
    const date = getActivityDate(activity);
    return date ? isWithinRange(date, priorWeekStart, priorWeekEnd) : false;
  });

  const plannedMinutes = plannedThisWeek.reduce((total, session) => total + sessionDurationMinutes(session), 0);
  const stravaMinutes = currentWeekActivities.reduce((total, activity) => total + Math.max(0, Number(activity.moving_time ?? 0) / 60), 0);
  const actualMinutes = stravaMinutes > 0 ? stravaMinutes : completedThisWeek.reduce((total, row) => total + (typeof row.duration === 'number' ? row.duration : estimateDurationFromTitle(getCompletedTitle(row))), 0);
  const priorMinutes = priorWeekActivities.reduce((total, activity) => total + Math.max(0, Number(activity.moving_time ?? 0) / 60), 0);
  const deltaMinutes = Math.round(actualMinutes - priorMinutes);

  const upcomingSessions = sessions
    .filter((session) => {
      const date = safeParseDate(session.date);
      return date ? isWithinRange(date, today, addDays(today, 10)) && session.sport !== 'Rest' : false;
    })
    .sort((a, b) => sessionPriority(b) - sessionPriority(a) || String(a.date).localeCompare(String(b.date)));

  const nextBestWorkout = upcomingSessions[0] ?? null;
  const nextWorkoutPoints = nextBestWorkout ? calculateSessionPoints({ sport: nextBestWorkout.sport, title: nextBestWorkout.title, durationMinutes: sessionDurationMinutes(nextBestWorkout) }) : 0;
  const plannedPoints = plannedThisWeek.reduce((total, session) => total + calculateSessionPoints({ sport: session.sport, title: session.title, durationMinutes: sessionDurationMinutes(session) }), 0);
  const earnedPoints = completedThisWeek.length > 0
    ? completedThisWeek.reduce((total, row) => total + calculateSessionPoints({ sport: row.sport, title: getCompletedTitle(row), durationMinutes: typeof row.duration === 'number' ? row.duration : estimateDurationFromTitle(getCompletedTitle(row)) }), 0)
    : currentWeekActivities.reduce((total, activity) => total + calculateSessionPoints({ sport: activity.sport_type, title: activity.name, durationMinutes: Math.max(0, Number(activity.moving_time ?? 0) / 60) }), 0);

  const completionPct = plannedThisWeek.length > 0 ? Math.round((completedThisWeek.length / plannedThisWeek.length) * 100) : 0;
  const volumeScore = plannedMinutes > 0 ? clamp((actualMinutes / plannedMinutes) * 100, 0, 110) : actualMinutes > 0 ? 55 : 0;
  const pointsScore = plannedPoints > 0 ? clamp((earnedPoints / plannedPoints) * 100, 0, 115) : earnedPoints > 0 ? 55 : 0;
  const readiness = Math.round(clamp(completionPct * 0.42 + pointsScore * 0.32 + volumeScore * 0.18 + (stravaConnected ? 8 : 0), 0, 95));
  const readinessLabel = readiness >= 80 ? 'On track' : readiness >= 60 ? 'Building' : readiness >= 35 ? 'Needs consistency' : 'Just starting';
  const pointsRemaining = Math.max(0, plannedPoints - earnedPoints);
  const missionText = plannedPoints > 0 ? `Earn ${pointsRemaining} more points and complete ${Math.max(0, plannedThisWeek.length - completedThisWeek.length)} planned sessions this week.` : 'Complete your next planned session to start building readiness.';
  const deltaText = Math.abs(deltaMinutes) < 5 ? 'flat vs last week' : `${deltaMinutes > 0 ? '+' : '−'}${formatMinutes(Math.abs(deltaMinutes))} vs last week`;

  return (
    <section className="mx-auto mb-6 w-full max-w-7xl px-4 sm:px-6 lg:px-10">
      <div className="rounded-[34px] border border-zinc-200 bg-[#fbfbfa] p-4 shadow-sm sm:p-6 lg:p-8">
        <div className="mb-7 flex flex-col gap-4 border-b border-zinc-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">TrainGPT command center</p>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">The simplest way to get ready for your triathlon.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">One next action, one weekly mission, and one readiness score based on the training you actually complete.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onAskCoach('Review my week and tell me the single most important thing to do next.')} className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800">Ask coach</button>
            <span className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-500">{countdown !== null ? `${countdown} days to race` : weekLabel}</span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="rounded-[28px] border border-zinc-200 bg-white p-5 sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Coach brief</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">{nextBestWorkout ? nextBestWorkout.title : 'Build your weekly mission'}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
              {nextBestWorkout ? `Your next best workout is worth ${nextWorkoutPoints} points because it moves the week forward. Points are a proof-of-work signal: complete useful training, earn credit, build readiness.` : 'Generate or open a plan so TrainGPT can turn the week into one clear next action.'}
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-zinc-50 p-4"><p className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">Next action</p><p className="mt-3 font-semibold text-zinc-950">{nextBestWorkout ? getSessionDateLabel(nextBestWorkout) : 'No workout yet'}</p><p className="mt-1 text-sm text-zinc-500">{nextBestWorkout ? `${formatMinutes(sessionDurationMinutes(nextBestWorkout))} · ${nextWorkoutPoints} pts` : 'Generate a plan first'}</p></div>
              <div className="rounded-2xl bg-zinc-50 p-4"><p className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">Weekly mission</p><p className="mt-3 font-semibold text-zinc-950">{earnedPoints}/{plannedPoints || 0} pts</p><p className="mt-1 text-sm text-zinc-500">{missionText}</p></div>
              <div className="rounded-2xl bg-zinc-50 p-4"><p className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400">Training load</p><p className="mt-3 font-semibold text-zinc-950">{formatMinutes(actualMinutes)}</p><p className="mt-1 text-sm text-zinc-500">{deltaText}</p></div>
            </div>
          </div>

          <div className="rounded-[28px] bg-zinc-950 p-5 text-white sm:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Race readiness</p>
            <div className="mt-5 flex items-end gap-3"><span className="text-6xl font-semibold tracking-tight">{readiness}</span><span className="pb-2 text-sm text-zinc-500">/ 100</span></div>
            <p className="mt-3 text-sm leading-6 text-zinc-300">{readinessLabel}. Target 82+ by race week.</p>
            <div className="mt-6 h-2 rounded-full bg-white/10"><div className="h-2 rounded-full bg-white" style={{ width: `${readiness}%` }} /></div>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-zinc-500">Adherence</p><p className="mt-1 font-semibold">{completionPct}%</p></div>
              <div><p className="text-zinc-500">Points</p><p className="mt-1 font-semibold">{plannedPoints > 0 ? Math.round((earnedPoints / plannedPoints) * 100) : 0}%</p></div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-3">
          {upcomingSessions.slice(0, 3).map((session) => {
            const points = calculateSessionPoints({ sport: session.sport, title: session.title, durationMinutes: sessionDurationMinutes(session) });
            return (
              <button key={session.id} type="button" onClick={() => onAskCoach(`Explain how to execute ${session.title} and why it matters for race readiness.`)} className="rounded-2xl border border-zinc-200 bg-white p-4 text-left transition hover:border-zinc-400 hover:bg-zinc-50">
                <div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${sportDotClass(session.sport)}`} /><span className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-400">{session.sport}</span></div><span className="text-xs text-zinc-400">{getSessionDateLabel(session)}</span></div>
                <p className="text-base font-semibold leading-6 text-zinc-950">{session.title}</p>
                <p className="mt-2 text-sm text-zinc-500">{formatMinutes(sessionDurationMinutes(session))} · {points} points</p>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
