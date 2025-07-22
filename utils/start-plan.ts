import { generateWeek } from './generate-week';
import { WeekMeta, UserParams, Week } from '@/types/plan';
import type { PlanType } from '@/types/plan';

export async function startPlan(
  planType: PlanType,
  {
    planMeta,
    userParams,
  }: {
    planMeta: WeekMeta[];
    userParams: UserParams;
  }
): Promise<Week[]> {
  const weeks = await Promise.all(
    planMeta.map((meta, index) =>
      generateWeek({
        planType,
        index,
        meta,
        params: userParams,
      })
    )
  );

  return weeks;
}
