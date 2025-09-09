// utils/start-plan.ts
import { generateWeek } from './generate-week';
import { guardWeek } from './planGuard';
import type { WeekMeta, UserParams, WeekJson, PlanType } from '@/types/plan';

export async function startPlan({
  planMeta,
  userParams,
  planType = 'triathlon',
}: {
  planMeta: WeekMeta[];
  userParams: UserParams;
  planType?: PlanType;
}) {
  const weeks: WeekJson[] = [];
  for (let i = 0; i < planMeta.length; i++) {
    const meta = planMeta[i];
    const raw: WeekJson = await generateWeek({ weekMeta: meta, userParams, planType, index: i });
    const safe: WeekJson = guardWeek(raw, userParams.trainingPrefs);
    weeks.push(safe);
  }
  return weeks;
}
