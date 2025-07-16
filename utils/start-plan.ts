import { generateWeek, UserParams, WeekMeta } from './generate-week';

export async function startPlan({
  planMeta,
  userParams,
}: {
  planMeta: WeekMeta[];
  userParams: UserParams;
}) {
  console.log(`⚡️ Starting plan generation for ${userParams.raceType}, ${planMeta.length} weeks`);

  const plan: string[] = [];

  for (let i = 0; i < planMeta.length; i++) {
    const week = await generateWeek({
      index: i,
      meta: planMeta[i],
      params: userParams,
    });

    plan.push(week);
  }

  return plan;
}
