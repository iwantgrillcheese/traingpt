import { WeekMeta, UserParams } from '@/types/plan';
import { generateWeek } from './generate-week';

interface StartPlanArgs {
  planMeta: WeekMeta[];
  userParams: UserParams;
}

export async function startPlan({ planMeta, userParams }: StartPlanArgs) {
  const weeks = [];
  const BATCH_SIZE = 3;

  for (let i = 0; i < planMeta.length; i += BATCH_SIZE) {
    const batch = planMeta.slice(i, i + BATCH_SIZE);

    const results = await Promise.all(
      batch.map((meta: WeekMeta, j: number) =>
        generateWeek({
          index: i + j,
          meta,
          params: userParams,
        })
      )
    );

    weeks.push(...results);
  }

  return weeks;
}
