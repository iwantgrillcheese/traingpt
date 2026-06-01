// utils/start-plan.ts
import { generateWeek } from './generate-week';
import { guardWeek } from './planGuard';
import type { WeekMeta, UserParams, WeekJson, PlanType } from '@/types/plan';

type StartPlanArgs = {
  planMeta?: WeekMeta[];
  weekMeta?: WeekMeta[];
  totalWeeks?: number;
  userParams: UserParams;
  planType?: PlanType;
  timeBudgetMs?: number;
  deadlineMs?: number;
};

export async function startPlan({
  planMeta,
  weekMeta,
  userParams,
  planType = 'triathlon',
  timeBudgetMs,
  deadlineMs,
}: StartPlanArgs) {
  const startedAt = Date.now();
  const resolvedPlanMeta = planMeta ?? weekMeta ?? [];
  const resolvedTimeBudgetMs = timeBudgetMs ?? (deadlineMs ? Math.max(1, deadlineMs - startedAt) : undefined);

  if (!resolvedPlanMeta.length) {
    throw new Error('startPlan requires planMeta or weekMeta.');
  }

  const weeks: WeekJson[] = new Array(resolvedPlanMeta.length);
  const isRunPlan = planType === 'running' || planType === 'run';
  const concurrency = isRunPlan
    ? 1
    : Math.max(1, Math.min(4, Number(process.env.PLAN_GENERATION_CONCURRENCY ?? 3) || 3));

  async function generateOneWeek(i: number, prevWeek?: WeekJson): Promise<WeekJson> {
    const elapsed = Date.now() - startedAt;
    if (resolvedTimeBudgetMs && elapsed > resolvedTimeBudgetMs) {
      throw new Error(`startPlan exceeded time budget (${Math.round(elapsed / 1000)}s).`);
    }

    const meta = resolvedPlanMeta[i];
    const w0 = Date.now();
    const raw: WeekJson = await generateWeek({
      weekMeta: meta,
      userParams,
      planType,
      index: i,
      prevWeek,
      totalWeeks: resolvedPlanMeta.length,
    });

    // Triathlon weeks are now scaffold-first. generateWeek() returns the final
    // scaffolded structure and GPT only enriches details. Do NOT run the legacy
    // guard here for triathlon plans: it converts structured sessions into
    // strings and can move/delete scaffolded Long Ride / Brick Run / Long Run slots.
    const safe: WeekJson = isRunPlan ? guardWeek(raw, userParams.trainingPrefs) : raw;

    const w1 = Date.now();
    console.log('[startPlan] week generated', {
      weekIndex: i,
      weekLabel: meta?.label,
      phase: meta?.phase,
      ms: w1 - w0,
      elapsedSec: Math.round((w1 - startedAt) / 1000),
      concurrency,
    });

    return safe;
  }

  if (isRunPlan) {
    for (let i = 0; i < resolvedPlanMeta.length; i++) {
      weeks[i] = await generateOneWeek(i, weeks[i - 1]);
    }

    return weeks;
  }

  for (let offset = 0; offset < resolvedPlanMeta.length; offset += concurrency) {
    const batchIndexes = resolvedPlanMeta
      .slice(offset, offset + concurrency)
      .map((_, batchOffset) => offset + batchOffset);

    console.log('[startPlan] week batch started', {
      indexes: batchIndexes,
      concurrency,
      elapsedSec: Math.round((Date.now() - startedAt) / 1000),
    });

    const batchResults = await Promise.all(batchIndexes.map((weekIndex) => generateOneWeek(weekIndex)));

    batchResults.forEach((week, idx) => {
      weeks[batchIndexes[idx]] = week;
    });
  }

  return weeks;
}
