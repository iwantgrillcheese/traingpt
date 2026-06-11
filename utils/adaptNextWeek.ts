// /utils/adaptNextWeek.ts
//
// Adaptive Week v1: a PURE, deterministic rules engine that adjusts next
// week's already-scaffolded sessions based on what actually happened last
// week. No LLM in the loop — adaptation decisions must be reliable,
// explainable, and free. The principles:
//
//   1. NEVER increase load in response to missed training.
//   2. Missed anchor (Long Ride / Long Run) → repeat its progression, don't stack.
//   3. Mostly-missed week → reset: trim volume, convert quality to endurance.
//   4. Partially-missed week → downgrade one quality session.
//   5. Race week is untouchable. Deload weeks only get the anchor-repeat rule.
//
// Every change carries a human-readable reason, and the whole adaptation is
// summarized in plain language for the weekly email / UI diff.

import type { WeekJson } from '@/types/plan';

export type StructuredPlanSession = {
  sport?: string;
  title?: string;
  details?: string;
  type?: string;
  durationMinutes?: number;
  priority?: string;
  [key: string]: unknown;
};

export type AdaptationChange = {
  date: string;
  sport: string;
  title: string;
  change: 'capped_duration' | 'reduced_duration' | 'downgraded_intensity';
  from: string;
  to: string;
  reason: string;
};

export type AdaptationInputs = {
  plannedCount: number; // non-rest planned sessions in the ended week
  completedCount: number;
  complianceRatio: number; // 0..1
  missedAnchors: Array<{ title: string; durationMinutes: number | null }>;
  nextWeekIsRaceWeek: boolean;
  nextWeekDeload: boolean;
};

export type AdaptationResult = {
  week: WeekJson;
  changes: AdaptationChange[];
  summary: string;
};

const MIN_SESSION_MINUTES = 20;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function roundTo5(minutes: number) {
  return Math.max(MIN_SESSION_MINUTES, Math.round(minutes / 5) * 5);
}

function isRestOrRace(session: StructuredPlanSession) {
  const sport = String(session.sport ?? '').toLowerCase();
  const title = String(session.title ?? '').toLowerCase();
  return sport === 'rest' || sport === 'other' || /race day|rest day/.test(title);
}

function isAnchor(session: StructuredPlanSession) {
  if (String(session.priority ?? '').toLowerCase() === 'anchor') return true;
  return /^(long ride|long run)$/i.test(String(session.title ?? '').trim());
}

function isQuality(session: StructuredPlanSession) {
  const type = String(session.type ?? '').toLowerCase();
  const title = String(session.title ?? '').toLowerCase();
  return /quality/.test(type) || /threshold|intervals/.test(title);
}

function annotate(session: StructuredPlanSession, reason: string) {
  const details = String(session.details ?? '').trim();
  const line = `Adaptation: ${reason}`;
  session.details = details ? `${details}\n${line}` : line;
}

function downgradeToEndurance(session: StructuredPlanSession): { from: string; to: string } | null {
  const sport = String(session.sport ?? '').toLowerCase();
  const from = String(session.title ?? '');

  if (sport === 'bike') {
    session.title = 'Bike Endurance';
    session.type = 'bike_endurance';
    return { from, to: 'Bike Endurance' };
  }
  if (sport === 'run') {
    session.title = 'Run Easy';
    session.type = 'run_easy';
    return { from, to: 'Run Easy' };
  }
  return null;
}

function cloneWeek(week: WeekJson): WeekJson {
  return JSON.parse(JSON.stringify(week)) as WeekJson;
}

function eachSession(week: WeekJson, fn: (session: StructuredPlanSession, date: string) => void) {
  for (const [date, items] of Object.entries(week.days ?? {})) {
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (isPlainRecord(item)) fn(item as StructuredPlanSession, date);
    }
  }
}

function buildSummary(inputs: AdaptationInputs, changes: AdaptationChange[]): string {
  const { completedCount, plannedCount } = inputs;
  const base =
    plannedCount > 0
      ? `You completed ${completedCount} of ${plannedCount} sessions last week.`
      : 'Last week had no scheduled sessions.';

  if (inputs.nextWeekIsRaceWeek) {
    return `${base} It's race week — the plan stays exactly as designed. Trust the taper.`;
  }

  if (!changes.length) {
    if (inputs.complianceRatio >= 0.8) {
      return `${base} Right on track — next week runs as planned. Protect the long ride and long run first.`;
    }
    return `${base} Next week runs as planned. Aim to bank the key sessions early in case life gets busy.`;
  }

  const capped = changes.filter((change) => change.change === 'capped_duration');
  const reduced = changes.filter((change) => change.change === 'reduced_duration');
  const downgraded = changes.filter((change) => change.change === 'downgraded_intensity');

  const parts: string[] = [];
  if (capped.length) {
    parts.push(
      `held ${capped.map((change) => change.title).join(' and ')} at last week's planned duration instead of progressing (the missed session needs to be absorbed, not stacked)`
    );
  }
  if (downgraded.length) {
    parts.push(`converted ${downgraded.map((change) => `${change.from} to ${change.to}`).join(', ')} to rebuild rhythm before intensity`);
  }
  if (reduced.length && !capped.length) {
    parts.push(`trimmed overall volume about 15–20% to reset after a tough week`);
  } else if (reduced.length) {
    parts.push(`trimmed supporting volume to keep the week absorbable`);
  }

  return `${base} I adjusted next week: ${parts.join('; ')}. Consistency beats catching up.`;
}

export function adaptNextWeek({
  nextWeek,
  inputs,
}: {
  nextWeek: WeekJson;
  inputs: AdaptationInputs;
}): AdaptationResult {
  const week = cloneWeek(nextWeek);
  const changes: AdaptationChange[] = [];

  // Rule 0: race week is sacred. No signal, no adaptation needed either way.
  if (inputs.nextWeekIsRaceWeek || inputs.plannedCount === 0) {
    return { week, changes, summary: buildSummary(inputs, changes) };
  }

  // Rule 1 — anchor repeat: a missed Long Ride / Long Run means next week's
  // matching anchor must not progress past what was already missed.
  for (const missed of inputs.missedAnchors) {
    const cap = Number(missed.durationMinutes ?? 0);
    if (!Number.isFinite(cap) || cap <= 0) continue;

    eachSession(week, (session, date) => {
      if (!isAnchor(session)) return;
      if (String(session.title ?? '').trim().toLowerCase() !== missed.title.trim().toLowerCase()) return;

      const current = Number(session.durationMinutes ?? 0);
      if (current > cap) {
        const reason = `last week's ${missed.title} was missed, so this one repeats that progression (${cap}min) instead of building on a session that didn't happen.`;
        session.durationMinutes = cap;
        annotate(session, reason);
        changes.push({
          date,
          sport: String(session.sport ?? ''),
          title: String(session.title ?? ''),
          change: 'capped_duration',
          from: `${current}min`,
          to: `${cap}min`,
          reason,
        });
      }
    });
  }

  const lowCompliance = inputs.complianceRatio < 0.5 && inputs.plannedCount >= 3;
  // A missed anchor at otherwise-high compliance is handled by the cap rule
  // alone — downgrading quality on top of it double-punishes one bad Saturday.
  const midCompliance = !lowCompliance && inputs.complianceRatio < 0.8;

  // Rule 2 — reset week: most of last week was missed. Trim volume, strip intensity.
  if (lowCompliance && !inputs.nextWeekDeload) {
    eachSession(week, (session, date) => {
      if (isRestOrRace(session)) return;

      const current = Number(session.durationMinutes ?? 0);
      const factor = isAnchor(session) ? 0.85 : 0.8;
      if (Number.isFinite(current) && current > MIN_SESSION_MINUTES) {
        const next = roundTo5(current * factor);
        if (next < current) {
          const reason = 'reset week after a mostly-missed week — rebuild consistency at lower volume before progressing again.';
          session.durationMinutes = next;
          annotate(session, reason);
          changes.push({
            date,
            sport: String(session.sport ?? ''),
            title: String(session.title ?? ''),
            change: 'reduced_duration',
            from: `${current}min`,
            to: `${next}min`,
            reason,
          });
        }
      }

      if (isQuality(session)) {
        const swap = downgradeToEndurance(session);
        if (swap) {
          const reason = 'intensity comes back after a consistent week — endurance first.';
          annotate(session, reason);
          changes.push({
            date,
            sport: String(session.sport ?? ''),
            title: swap.to,
            change: 'downgraded_intensity',
            from: swap.from,
            to: swap.to,
            reason,
          });
        }
      }
    });
  }

  // Rule 3 — trim: a partially-missed week downgrades ONE quality session.
  if (midCompliance && !lowCompliance && !inputs.nextWeekDeload) {
    let done = false;
    eachSession(week, (session, date) => {
      if (done || isRestOrRace(session) || !isQuality(session) || isAnchor(session)) return;
      const swap = downgradeToEndurance(session);
      if (swap) {
        const reason = `last week was incomplete (${inputs.completedCount}/${inputs.plannedCount}), so one quality session becomes steady endurance to protect the key work.`;
        annotate(session, reason);
        changes.push({
          date,
          sport: String(session.sport ?? ''),
          title: swap.to,
          change: 'downgraded_intensity',
          from: swap.from,
          to: swap.to,
          reason,
        });
        done = true;
      }
    });
  }

  return { week, changes, summary: buildSummary(inputs, changes) };
}
