// /utils/start-plan.ts
import { generateWeek } from './generate-week';
import type { WeekMeta, UserParams } from '@/types/plan';
import type { ParsedWeek } from '@/utils/generate-week';

export async function startPlan({
  planMeta,
  userParams,
}: {
  planMeta: WeekMeta[];
  userParams: UserParams;
}): Promise<ParsedWeek[]> {
  console.log(`⚡️ Starting plan generation: ${planMeta.length} weeks for ${userParams.raceType}`);

  const plan: ParsedWeek[] = [];

  for (let i = 0; i < planMeta.length; i++) {
    const sessions = await generateWeek({
      index: i,
      meta: planMeta[i],
      params: userParams,
    });

    plan.push(sessions);
  }

  return plan;
}
