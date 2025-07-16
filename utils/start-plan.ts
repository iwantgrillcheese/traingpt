// /utils/start-plan.ts
import { generateWeek } from './generate-week';
import { WeekMeta, UserParams } from '@/types/plan';

export async function startPlan({
  planMeta,
  userParams,
}: {
  planMeta: WeekMeta[];
  userParams: UserParams;
}) {
  // Parallel generation of all weeks
  const weeks = await Promise.all(
    planMeta.map((meta, index) => generateWeek({ index, meta, params: userParams }))
  );

  // Flatten all weeks' days into a single days object
  const days = weeks.reduce((acc, week) => {
    Object.entries(week.days).forEach(([date, sessions]) => {
      acc[date] = sessions;
    });
    return acc;
  }, {} as Record<string, string[]>);

  return {
    label: `${userParams.raceType} Plan`,
    startDate: userParams.startDate.toISOString().split('T')[0],
    raceDate: userParams.raceDate.toISOString().split('T')[0],
    days,
  };
}
