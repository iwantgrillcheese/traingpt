// start-plan.ts
import { generateWeek } from './generate-week';

export async function startPlan({
  planMeta,
  userParams,
}: {
  planMeta: any[];
  userParams: any;
}): Promise<any[][]> {
  console.log(`⚡️ Starting plan generation: ${planMeta.length} weeks for ${userParams.raceType}`);

  const plan: any[][] = [];

  for (let i = 0; i < planMeta.length; i++) {
    const week = planMeta[i];
    console.log(`📅 Generating week ${i + 1} — ${week.label}`);

    const sessions = await generateWeek({
      userParams,
      week,
    });

    plan.push(sessions);
  }

  return plan;
}
