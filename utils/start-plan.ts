// /utils/start-plan.ts
import { generateWeek } from './generate-week';
import { WeekMeta, UserParams, Week } from '@/types/plan';

export async function startPlan({
  planMeta,
  userParams,
}: {
  planMeta: WeekMeta[];
  userParams: UserParams;
}): Promise<Week[]> {
  const weeks = await Promise.all(
    planMeta.map((meta, index) => generateWeek({ index, meta, params: userParams }))
  );

  return weeks; // Array of full weekly objects including days
}
