import { format } from 'date-fns';
import type { CompletedSession } from '@/types/session';
import { findCompletion } from '@/utils/sessionCompletion';
import type { MergedSession } from '@/utils/mergeSessionWithStrava';

export function calendarSport(value?: string | null) {
  const sport = String(value ?? '').toLowerCase();
  if (sport.includes('swim')) return 'Swim';
  if (/bike|ride|cycle/.test(sport)) return 'Bike';
  if (sport.includes('run')) return 'Run';
  if (/strength|gym/.test(sport)) return 'Strength';
  if (/rest|off/.test(sport)) return 'Rest';
  return 'Other';
}

export function sportColor(sport: string) {
  return `var(--sport-${calendarSport(sport).toLowerCase()}, #9CA3AF)`;
}

export function workoutTitle(title?: string | null) {
  return String(title || 'Untitled workout').replace(/^\p{Extended_Pictographic}\s*/u, '').replace(/^[\s:•·—–-]+/, '').replace(/\s{2,}/g, ' ').trim();
}

export function formatTrainingMinutes(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  const minutes = Math.round(value);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours}h${remainder ? ` ${remainder}m` : ''}` : `${minutes}m`;
}

export function sessionStatus(session: MergedSession, completed: CompletedSession[]) {
  if (session.stravaActivity) return 'done';
  const match = findCompletion(completed, session);
  return match && match.status !== 'planned' ? match.status ?? 'done' : null;
}

export function isRestSession(session: MergedSession) {
  return calendarSport(session.sport) === 'Rest' || /^rest day$/i.test(workoutTitle(session.title));
}

export function monthTrainingSummary(sessions: MergedSession[], completed: CompletedSession[], month: Date) {
  const prefix = format(month, 'yyyy-MM') + '-';
  const workouts = sessions.filter(session => session.date?.startsWith(prefix) && !isRestSession(session));
  const done = workouts.filter(session => sessionStatus(session, completed) === 'done');
  const minutes = (value?: number | null) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0;
  return {
    planned: workouts.length,
    done: done.length,
    plannedMinutes: workouts.reduce((sum, session) => sum + minutes(session.duration), 0),
    completedMinutes: done.reduce((sum, session) => sum + (session.stravaActivity ? minutes(session.stravaActivity.moving_time) / 60 : minutes(session.duration)), 0),
    completion: workouts.length ? Math.round(done.length / workouts.length * 100) : 0,
  };
}
