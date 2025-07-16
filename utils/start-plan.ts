import { generateWeek } from '@/utils/generate-week';

type WeekMeta = {
  label: string;
  phase: string;
  deload: boolean;
  startDate: string; // ISO format
};

type UserParams = {
  raceType: string;
  raceDate: Date;
  startDate: Date;
  totalWeeks: number;
  experience: string;
  maxHours: number;
  restDay: string;
  bikeFTP: string | null;
  runPace: string | null;
  swimPace: string | null;
  userNote: string;
};

export async function startPlan({
  planMeta,
  userParams,
}: {
  planMeta: WeekMeta[];
  userParams: UserParams;
}) {
  const {
    raceType,
    raceDate,
    startDate,
    totalWeeks,
    experience,
    maxHours,
    restDay,
    bikeFTP,
    runPace,
    swimPace,
    userNote,
  } = userParams;

  const plan: string[] = [];

  for (let i = 0; i < totalWeeks; i++) {
    const week = await generateWeek({
      index: i,
      meta: planMeta[i],
      params: {
        raceType,
        raceDate,
        startDate,
        totalWeeks,
        experience,
        maxHours,
        restDay,
        bikeFTP,
        runPace,
        swimPace,
        userNote,
      },
    });

    plan.push(week);
  }

  return plan;
}
