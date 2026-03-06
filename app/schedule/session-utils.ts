import { format, isSameDay, isAfter, startOfDay } from 'date-fns';

type SessionLike = {
  id?: string;
  date: string;
  title?: string | null;
  sport?: string | null;
};

function safeDate(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isKeySessionTitle(title: string) {
  const t = title.toLowerCase();
  return /(long|tempo|threshold|interval|brick|race pace)/i.test(t);
}

export function conciseSessionLabel(title?: string | null, sport?: string | null) {
  const raw = String(title ?? '')
    .replace(/^\p{Extended_Pictographic}\s*/u, '')
    .replace(/\s+[—–-]\s+/g, ' ')
    .replace(/[—–]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!raw) return sport ? `${sport} session` : 'Session';

  const cap = raw.length > 80 ? `${raw.slice(0, 77).trim()}…` : raw;
  return cap;
}

export function getTodaysPrimarySession<T extends SessionLike>(sessions: T[], today = new Date()): T | null {
  const todays = sessions.filter((s) => {
    const d = safeDate(s.date);
    return d ? isSameDay(d, today) : false;
  });

  if (!todays.length) return null;

  const keyed = todays.find((s) => isKeySessionTitle(String(s.title ?? '')));
  return keyed ?? todays[0] ?? null;
}

export function getNextUpcomingSession<T extends SessionLike>(sessions: T[], today = new Date()): T | null {
  const start = startOfDay(today);
  const upcoming = sessions
    .map((s) => ({ session: s, date: safeDate(s.date) }))
    .filter((x): x is { session: T; date: Date } => !!x.date)
    .filter((x) => isAfter(startOfDay(x.date), start) || isSameDay(x.date, start))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((x) => x.session);

  return upcoming[0] ?? null;
}

export function formatWeekPhaseHeader(weekRangeLabel: string, phase?: string | null) {
  if (!phase) return weekRangeLabel;
  return `${weekRangeLabel} • ${phase}`;
}

export function formatSessionDateLabel(date?: string | null) {
  const d = safeDate(date);
  if (!d) return 'Unknown date';
  return format(d, 'EEE, MMM d');
}
