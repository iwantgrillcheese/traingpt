import type { CompletedSessionRow, SessionRow } from '../types';

export function parseDate(value?: string | null) {
  if (!value) return new Date();
  const date = new Date(value.includes('T') ? value : `${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export function formatDay(value?: string | null) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(parseDate(value));
}

export function formatMinutes(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  if (value < 60) return `${Math.round(value)} min`;
  const h = Math.floor(value / 60);
  const m = Math.round(value % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function cleanTitle(value?: string | null) {
  return String(value ?? 'Training session')
    .replace(/^\p{Extended_Pictographic}\s*/u, '')
    .replace(/^[\s—–-]+/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function normalizeSport(value?: string | null) {
  const sport = String(value ?? '').toLowerCase();
  if (sport.includes('swim')) return 'Swim';
  if (sport.includes('bike') || sport.includes('ride')) return 'Bike';
  if (sport.includes('run')) return 'Run';
  if (sport.includes('brick')) return 'Brick';
  if (sport.includes('strength')) return 'Strength';
  if (sport.includes('rest')) return 'Rest';
  return 'Session';
}

export function isSameLocalDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function getCompletionStatus(session: SessionRow, completed: CompletedSessionRow[]) {
  const match = completed.find((row) => row.date === session.date && row.session_title === session.title);
  if (!match) return null;
  return match.status === 'skipped' ? 'skipped' : 'done';
}

export function getNextSession(sessions: SessionRow[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return sessions
    .filter((session) => parseDate(session.date) >= today)
    .sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime())[0] ?? null;
}

export function getTodaysSessions(sessions: SessionRow[]) {
  const now = new Date();
  return sessions
    .filter((session) => isSameLocalDay(parseDate(session.date), now))
    .sort((a, b) => String(a.sport ?? '').localeCompare(String(b.sport ?? '')));
}

export function currentWeekStats(sessions: SessionRow[], completed: CompletedSessionRow[]) {
  const now = new Date();
  const day = now.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  const start = new Date(now);
  start.setDate(now.getDate() + offset);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  const weekSessions = sessions.filter((session) => {
    const date = parseDate(session.date);
    return date >= start && date <= end;
  });

  const done = weekSessions.filter((session) => getCompletionStatus(session, completed) === 'done').length;
  const minutes = weekSessions.reduce((total, session) => total + (Number(session.duration) || 0), 0);

  return {
    planned: weekSessions.length,
    done,
    minutes,
    adherence: weekSessions.length ? Math.round((done / weekSessions.length) * 100) : 0,
  };
}
