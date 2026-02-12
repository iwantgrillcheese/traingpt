import { differenceInCalendarDays, parseISO, startOfDay, subDays } from 'date-fns';

type SessionLike = {
  date?: string | null;
  title?: string | null;
};

type CompletedLike = {
  date?: string | null;
  session_date?: string | null;
  session_title?: string | null;
  title?: string | null;
};

export type ReadinessLabel = 'On track' | 'Mostly on track' | 'Needs consistency' | 'At risk';

export type ReadinessResult = {
  score: number;
  label: ReadinessLabel;
  parts: {
    compliance: number;
    trend: number;
    recency: number;
    proximityMultiplier: number;
  };
};

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function safeDate(value?: string | null): Date | null {
  if (!value) return null;
  try {
    const d = parseISO(value);
    if (Number.isNaN(d.getTime())) return null;
    return startOfDay(d);
  } catch {
    return null;
  }
}

function keyDateTitle(date: Date, title?: string | null) {
  return `${date.toISOString().slice(0, 10)}::${(title ?? '').trim().toLowerCase()}`;
}

function scoreLabel(score: number): ReadinessLabel {
  if (score >= 85) return 'On track';
  if (score >= 65) return 'Mostly on track';
  if (score >= 45) return 'Needs consistency';
  return 'At risk';
}

export function calculateReadiness(params: {
  sessions: SessionLike[];
  completedSessions: CompletedLike[];
  raceDate?: string | null;
  now?: Date;
}): ReadinessResult {
  const now = startOfDay(params.now ?? new Date());

  const planned = (params.sessions ?? [])
    .map((s) => ({ date: safeDate(s.date), title: s.title ?? null }))
    .filter((s): s is { date: Date; title: string | null } => Boolean(s.date))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const planStart = planned[0]?.date ?? subDays(now, 28);
  const plannedToDate = planned.filter((s) => s.date >= planStart && s.date <= now);

  const completedSet = new Set(
    (params.completedSessions ?? [])
      .map((c) => {
        const d = safeDate(c.session_date ?? c.date ?? null);
        if (!d) return null;
        const t = c.session_title ?? c.title ?? null;
        return keyDateTitle(d, t);
      })
      .filter((k): k is string => Boolean(k))
  );

  const completedToDate = plannedToDate.filter((s) => completedSet.has(keyDateTitle(s.date, s.title))).length;
  const compliance = plannedToDate.length > 0 ? clamp01(completedToDate / plannedToDate.length) : 0.55;

  const weekRatios: number[] = [];
  for (let i = 0; i < 4; i++) {
    const wEnd = subDays(now, i * 7);
    const wStart = subDays(wEnd, 6);
    const plannedWeek = plannedToDate.filter((s) => s.date >= wStart && s.date <= wEnd);
    if (!plannedWeek.length) continue;
    const completedWeek = plannedWeek.filter((s) => completedSet.has(keyDateTitle(s.date, s.title))).length;
    weekRatios.push(clamp01(completedWeek / plannedWeek.length));
  }
  const trendWeights = [0.4, 0.3, 0.2, 0.1];
  const trend = weekRatios.length
    ? clamp01(
        weekRatios.reduce((sum, r, idx) => sum + r * (trendWeights[idx] ?? 0), 0) /
          trendWeights.slice(0, weekRatios.length).reduce((a, b) => a + b, 0)
      )
    : compliance;

  const last7Start = subDays(now, 6);
  const plannedLast7 = plannedToDate.filter((s) => s.date >= last7Start && s.date <= now);
  const completedLast7 = plannedLast7.filter((s) => completedSet.has(keyDateTitle(s.date, s.title))).length;
  const recency = plannedLast7.length > 0 ? clamp01(completedLast7 / plannedLast7.length) : compliance;

  const race = safeDate(params.raceDate ?? null);
  const daysToRace = race ? differenceInCalendarDays(race, now) : null;
  const pressure = daysToRace == null ? 0 : clamp01((42 - Math.max(daysToRace, 0)) / 42);
  const missedWork = 1 - compliance;
  const proximityMultiplier = 1 - pressure * missedWork * 0.35;

  const base = 0.5 * compliance + 0.25 * trend + 0.25 * recency;
  const score = Math.max(0, Math.min(100, Math.round(base * 100 * proximityMultiplier)));

  return {
    score,
    label: scoreLabel(score),
    parts: {
      compliance,
      trend,
      recency,
      proximityMultiplier,
    },
  };
}
