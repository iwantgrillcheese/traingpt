// utils/start-plan.ts
import { generateWeek } from './generate-week';
import { guardWeek } from './planGuard';
import type { WeekMeta, UserParams, WeekJson, PlanType } from '@/types/plan';

export async function startPlan({
  planMeta,
  userParams,
  planType = 'triathlon',
  timeBudgetMs,
}: {
  planMeta: WeekMeta[];
  userParams: UserParams;
  planType?: PlanType;
  timeBudgetMs?: number;
}) {
  const startedAt = Date.now();
  const weeks: WeekJson[] = [];

  for (let i = 0; i < planMeta.length; i++) {
    const elapsed = Date.now() - startedAt;
    if (timeBudgetMs && elapsed > timeBudgetMs) {
      throw new Error(`startPlan exceeded time budget (${Math.round(elapsed / 1000)}s).`);
    }

    const meta = planMeta[i];
    const w0 = Date.now();
    const raw: WeekJson = await generateWeek({ weekMeta: meta, userParams, planType, index: i });
    const safe: WeekJson = guardWeek(raw, userParams.trainingPrefs);
    weeks.push(safe);

    const w1 = Date.now();
    console.log('[startPlan] week generated', {
      weekIndex: i,
      weekLabel: meta?.label,
      phase: meta?.phase,
      ms: w1 - w0,
      elapsedSec: Math.round((w1 - startedAt) / 1000),
    });
  }

  return weeks;
}
