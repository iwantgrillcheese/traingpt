import type { CompletedSessionRow, SessionRow } from '../types';
import { normalizeSport, parseDate } from './training';

export type SessionPriority = 'key' | 'supporting' | 'light';

function normalizedText(session: SessionRow) {
  return `${session.title ?? ''} ${session.details ?? ''} ${session.sport ?? ''}`.toLowerCase();
}

export function getSessionPriority(session: SessionRow): SessionPriority {
  const text = normalizedText(session);
  const sport = normalizeSport(session.sport);
  const duration = Number(session.duration ?? 0);

  if (sport === 'Rest') return 'light';
  if (text.includes('long ride') || text.includes('long run')) return 'key';
  if (text.includes('threshold') || text.includes('tempo') || text.includes('interval') || text.includes('race pace')) return 'key';
  if (text.includes('brick')) return 'key';
  if (duration >= 90 && (sport === 'Bike' || sport === 'Run')) return 'key';
  if (text.includes('technique') || text.includes('drill') || text.includes('mobility') || sport === 'Strength') return 'light';

  return 'supporting';
}

export function getSessionPoints(session: SessionRow): number {
  const text = normalizedText(session);
  const sport = normalizeSport(session.sport);
  const duration = Number(session.duration ?? 0);

  if (sport === 'Rest') return 5;
  if (text.includes('long ride') || text.includes('long run')) return 40;
  if (text.includes('threshold') || text.includes('tempo') || text.includes('interval') || text.includes('race pace')) return 30;
  if (text.includes('brick')) return 25;
  if (text.includes('technique') || text.includes('drill')) return 10;
  if (sport === 'Strength' || text.includes('mobility')) return 10;
  if (duration >= 90 && (sport === 'Bike' || sport === 'Run')) return 35;
  if (duration >= 60) return 20;
  return 15;
}

export function sessionCompletionKey(date?: string | null, title?: string | null) {
  return `${date ?? ''}-${String(title ?? '').trim().toLowerCase()}`;
}

export function completedKeySet(completed: CompletedSessionRow[]) {
  return new Set(
    completed
      .filter((row) => row.status === 'done')
      .map((row) => sessionCompletionKey(row.date, row.session_title))
  );
}

export function getEarnedPoints(sessions: SessionRow[], completed: CompletedSessionRow[]) {
  const done = completedKeySet(completed);
  return sessions.reduce((sum, session) => {
    return done.has(sessionCompletionKey(session.date, session.title)) ? sum + getSessionPoints(session) : sum;
  }, 0);
}

export function getTotalAvailablePoints(sessions: SessionRow[]) {
  return sessions.reduce((sum, session) => sum + getSessionPoints(session), 0);
}

export function getWeeklyPointStats(sessions: SessionRow[], completed: CompletedSessionRow[], referenceDate = new Date()) {
  const start = new Date(referenceDate);
  const day = start.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + offset);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  const weekSessions = sessions.filter((session) => {
    const date = parseDate(session.date);
    return date >= start && date <= end;
  });

  return {
    earned: getEarnedPoints(weekSessions, completed),
    available: getTotalAvailablePoints(weekSessions),
    sessions: weekSessions,
  };
}
