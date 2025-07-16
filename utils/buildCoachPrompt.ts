import { format } from 'date-fns';
import { COACH_SYSTEM_PROMPT } from '@/lib/coachPrompt';

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
  weekMeta,
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
  weekMeta: { label: string; phase: string; deload: boolean; startDate: string }[];
}) {
  // Dynamically inject performance metrics into userNote block if available
  const performanceDetails = [];

  if (bikeFTP) performanceDetails.push(`Bike FTP: ${bikeFTP} watts`);
  if (runPace) performanceDetails.push(`Run Threshold Pace: ${runPace}`);
  if (swimPace) performanceDetails.push(`Swim Threshold Pace: ${swimPace}`);

  const performanceNote = performanceDetails.length
    ? `\n\nPerformance Metrics:\n${performanceDetails.join('\n')}`
    : '';

  const finalUserNote = (userNote || 'None provided') + performanceNote;

  return COACH_SYSTEM_PROMPT
    .replace('[RACE_TYPE]', raceType)
    .replace('[RACE_DATE]', format(raceDate, 'yyyy-MM-dd'))
    .replace('[START_DATE]', format(startDate, 'yyyy-MM-dd'))
    .replace('[TOTAL_WEEKS]', `${totalWeeks}`)
    .replace('[EXPERIENCE_LEVEL]', experience)
    .replace('[MAX_HOURS]', `${maxHours}`)
    .replace('[REST_DAY]', restDay)
    .replace('[USER_NOTE]', finalUserNote);
}
