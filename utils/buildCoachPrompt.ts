import { format } from 'date-fns';

export function buildCoachPrompt({
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
}: {
  raceType: string;
  raceDate: Date;
  startDate: Date;
  totalWeeks: number;
  experience: string;
  maxHours: number;
  restDay: string;
  bikeFTP?: string;
  runPace?: string;
  swimPace?: string;
  userNote?: string;
}) {
  const performanceDetails = [];

  if (bikeFTP) performanceDetails.push(`- Bike FTP: ${bikeFTP} watts`);
  if (runPace) performanceDetails.push(`- Run Threshold Pace: ${runPace}`);
  if (swimPace) performanceDetails.push(`- Swim Threshold Pace: ${swimPace}`);

  const performanceNote = performanceDetails.length
    ? `\nPerformance Metrics:\n${performanceDetails.join('\n')}`
    : '';

  return `
Athlete Profile:
- Race Type: ${raceType}
- Race Date: ${format(raceDate, 'yyyy-MM-dd')}
- Plan Start Date: ${format(startDate, 'yyyy-MM-dd')}
- Total Weeks: ${totalWeeks}
- Experience Level: ${experience}
- Max Training Hours per Week: ${maxHours}
- Preferred Rest Day: ${restDay}
- Notes: ${userNote || 'None'}${performanceNote}
`.trim();
}
