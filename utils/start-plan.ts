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

const SAFE_PLAN_BUDGET_MS = Math.max(
  30_000,
  Math.min(85_000, Number(process.env.PLAN_GENERATION_TIME_BUDGET_MS ?? 80_000) || 80_000),
);
const MIN_REMAINING_MS_TO_START_WEEK = 12_000;

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
  const callerBudgetMs = timeBudgetMs ?? (deadlineMs ? Math.max(1, deadlineMs - startedAt) : undefined);
  const resolvedTimeBudgetMs = callerBudgetMs
    ? Math.min(callerBudgetMs, SAFE_PLAN_BUDGET_MS)
    : SAFE_PLAN_BUDGET_MS;

  if (!resolvedPlanMeta.length) {
    throw new Error('startPlan requires planMeta or weekMeta.');
  }

  const weeks: WeekJson[] = new Array(resolvedPlanMeta.length);
  const isRunPlan = planType === 'running' || planType === 'run';
  const concurrency = isRunPlan
    ? 1
    : Math.max(1, Math.min(4, Number(process.env.PLAN_GENERATION_CONCURRENCY ?? 3) || 3));

  function assertTimeBudget(stage: string) {
    const elapsed = Date.now() - startedAt;
    const remaining = resolvedTimeBudgetMs - elapsed;

    if (remaining <= MIN_REMAINING_MS_TO_START_WEEK) {
      throw new Error(
        `Plan generation exceeded its safe time budget during ${stage}. ` +
          `Elapsed ${Math.round(elapsed / 1000)}s, remaining ${Math.round(remaining / 1000)}s.`,
      );
    }

    return { elapsed, remaining };
  }

  async function generateOneWeek(i: number, prevWeek?: WeekJson): Promise<WeekJson> {
    const { elapsed, remaining } = assertTimeBudget(`week ${i + 1} start`);

    const meta = resolvedPlanMeta[i];
    const w0 = Date.now();
    console.log('[startPlan] week generation started', {
      weekIndex: i,
      weekLabel: meta?.label,
      phase: meta?.phase,
      elapsedSec: Math.round(elapsed / 1000),
      remainingSec: Math.round(remaining / 1000),
      concurrency,
      planType,
    });

    const raw: WeekJson = await generateWeek({
      weekMeta: meta,
      userParams,
      planType,
      index: i,
      prevWeek,
      totalWeeks: resolvedPlanMeta.length,
    });

    const safe: WeekJson = isRunPlan ? guardWeek(raw, userParams.trainingPrefs) : raw;

    const w1 = Date.now();
    console.log('[startPlan] week generated', {
      weekIndex: i,
      weekLabel: meta?.label,
      phase: meta?.phase,
      ms: w1 - w0,
      elapsedSec: Math.round((w1 - startedAt) / 1000),
      concurrency,
      planType,
    });

    return safe;
  }

  console.log('[startPlan] plan generation started', {
    weeks: resolvedPlanMeta.length,
    planType,
    concurrency,
    budgetSec: Math.round(resolvedTimeBudgetMs / 1000),
  });

  if (isRunPlan) {
    for (let i = 0; i < resolvedPlanMeta.length; i++) {
      weeks[i] = await generateOneWeek(i, weeks[i - 1]);
    }

    console.log('[startPlan] plan generation finished', {
      weeks: weeks.length,
      planType,
      elapsedSec: Math.round((Date.now() - startedAt) / 1000),
    });

    return weeks;
  }

  for (let offset = 0; offset < resolvedPlanMeta.length; offset += concurrency) {
    assertTimeBudget(`batch starting at week ${offset + 1}`);

    const batchIndexes = resolvedPlanMeta
      .slice(offset, offset + concurrency)
      .map((_, batchOffset) => offset + batchOffset);

    console.log('[startPlan] week batch started', {
      indexes: batchIndexes,
      concurrency,
      elapsedSec: Math.round((Date.now() - startedAt) / 1000),
      planType,
    });

    const batchResults = await Promise.all(batchIndexes.map((weekIndex) => generateOneWeek(weekIndex)));
    batchResults.forEach((week, idx) => {
      weeks[batchIndexes[idx]] = week;
    });
  }

  console.log('[startPlan] plan generation finished', {
    weeks: weeks.length,
    planType,
    elapsedSec: Math.round((Date.now() - startedAt) / 1000),
  });

  return weeks;
}
