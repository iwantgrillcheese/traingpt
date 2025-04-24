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
}: {
  raceType: string;
  raceDate: Date;
  startDate: Date;
  totalWeeks: number;
  experience: string;
  maxHours: number;
  restDay: string;
  bikeFTP: string;
  runPace: string;
  swimPace: string;
  userNote: string;
}) {
  return COACH_SYSTEM_PROMPT
    .replace('[RACE_TYPE]', raceType)
    .replace('[RACE_DATE]', format(raceDate, 'yyyy-MM-dd'))
    .replace('[START_DATE]', format(startDate, 'yyyy-MM-dd'))
    .replace('[TOTAL_WEEKS]', `${totalWeeks}`)
    .replace('[EXPERIENCE_LEVEL]', experience)
    .replace('[MAX_HOURS]', `${maxHours}`)
    .replace('[REST_DAY]', restDay)
    .replace('[BIKE_FTP]', bikeFTP)
    .replace('[RUN_PACE]', runPace)
    .replace('[SWIM_PACE]', swimPace)
    .replace('[USER_NOTE]', userNote || 'None provided');
}
