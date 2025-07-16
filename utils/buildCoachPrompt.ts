// buildCoachPrompt.ts
import { format } from 'date-fns';

export function buildCoachPrompt({ userParams, week }: { userParams: any; week: any }): string {
  const { raceType, experience, maxHours, restDay, userNote, raceDate, bikeFTP, runPace, swimPace } = userParams;

  const zones = [
    bikeFTP ? `- Bike FTP: ${bikeFTP} watts` : null,
    runPace ? `- Run Threshold Pace: ${runPace}` : null,
    swimPace ? `- Swim Threshold Pace: ${swimPace}` : null,
  ].filter(Boolean).join('\n');

  const base = `
You're generating WEEK ${week.index + 1} of a triathlon training plan.
Race Type: ${raceType}
Race Date: ${raceDate}
Experience: ${experience}
Max Weekly Hours: ${maxHours}
Preferred Rest Day: ${restDay}
${zones ? `\nPerformance Zones:\n${zones}` : ''}
${userNote ? `\nAthlete Notes: ${userNote}` : ''}

Output 5-7 sessions as a JSON array of strings, like:
["🏊‍♂️ Swim: 2000m easy technique", "🚴‍♂️ Bike: 90min Z2", ...]
`; 

  return base.trim();
}
