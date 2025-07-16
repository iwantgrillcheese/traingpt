// /utils/buildCoachPrompt.ts
import { format } from 'date-fns';
import type { UserParams, WeekMeta } from '@/types/plan';

export function buildCoachPrompt({
  userParams,
  weekMeta,
  index,
}: {
  userParams: UserParams;
  weekMeta: WeekMeta;
  index: number;
}): string {
  const {
    raceType,
    raceDate,
    experience,
    maxHours,
    restDay,
    userNote,
    bikeFTP,
    runPace,
    swimPace,
  } = userParams;

  const zones = [
    bikeFTP ? `- Bike FTP: ${bikeFTP} watts` : null,
    runPace ? `- Run Threshold Pace: ${runPace}` : null,
    swimPace ? `- Swim Threshold Pace: ${swimPace}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return `
You're generating **WEEK ${index + 1}** of a triathlon training plan.

Race Type: ${raceType}
Race Date: ${format(new Date(raceDate), 'yyyy-MM-dd')}
Experience Level: ${experience}
Max Weekly Hours: ${maxHours}
Preferred Rest Day: ${restDay}

${zones ? `Performance Zones:\n${zones}` : ''}

${userNote ? `Athlete Notes:\n${userNote}` : ''}

Output 5–7 sessions as a JSON array of strings per day (like ["🏊‍♂️ Swim: 2000m Z2", "🏃‍♂️ Run: 45min easy"]).
  `.trim();
}
