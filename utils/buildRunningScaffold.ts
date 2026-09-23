import { addDays, formatISO, parseISO } from 'date-fns';
import { computeRunTargets } from './runTargets';
import type { UserParams, WeekJson, WeekMeta } from '@/types/plan';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function dayIndex(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6) return value;
  const index = DAY_NAMES.findIndex(day => day.toLowerCase() === String(value ?? '').trim().toLowerCase());
  return index < 0 ? undefined : index;
}

function easyIntensity(params: UserParams): string {
  const match = String(params.runPace ?? '').match(/(\d{1,2}):(\d{2})/);
  if (!match || Number(match[2]) >= 60) return 'Conversational effort, RPE 2–3/10; walk breaks are welcome.';
  const seconds = Number(match[1]) * 60 + Number(match[2]);
  const unit = params.paceUnit ?? (/\/\s*km/i.test(params.runPace ?? '') ? 'km' : 'mi');
  const pace = (extra: number) => `${Math.floor((seconds + extra) / 60)}:${String((seconds + extra) % 60).padStart(2, '0')}`;
  return `Approximately ${pace(75)}–${pace(115)}/${unit}; conversational RPE 2–3/10 takes priority over pace.`;
}

/** Build a complete usable schedule without a model, network, or API key.
 * Existing run targets provide progression; availability and recovery are hard caps.
 */
export function buildRunningPlanScaffold({ userParams, weekMeta }: {
  userParams: UserParams;
  weekMeta: WeekMeta[];
}): WeekJson[] {
  const blocked = new Set([userParams.restDay, ...(userParams.unavailableDays ?? [])]
    .map(dayIndex).filter((day): day is number => day !== undefined));
  const preferred = dayIndex(userParams.preferredLongRunDay ?? userParams.trainingPrefs?.longRunDay) ?? 0;
  const beginner = /beginner|new/i.test(userParams.experience ?? '');
  const advanced = /advanced/i.test(userParams.experience ?? '');
  const maxRunDays = beginner ? 4 : advanced ? 6 : 5;
  const weeklyCap = Math.floor(userParams.maxHours * 60);
  const weeks: WeekJson[] = [];
  let previousVolume = 0;
  let previousLong = 0;

  for (const [index, meta] of weekMeta.entries()) {
    const dates = Array.from({ length: 7 }, (_, offset) => {
      const date = addDays(parseISO(meta.startDate), offset);
      return { iso: formatISO(date, { representation: 'date' }), dow: date.getDay(), offset };
    });
    const days: WeekJson['days'] = Object.fromEntries(dates.map(date => [date.iso, []]));
    const raceWeek = dates.some(date => date.iso === userParams.raceDate);
    const taper = raceWeek || /taper/i.test(meta.phase);
    // Never train after race day. Race day itself overrides ordinary availability.
    const available = dates.filter(date => !blocked.has(date.dow) && date.iso < userParams.raceDate);
    const targets = computeRunTargets({ userParams, weekMeta: meta, weekIndex: index, prevWeek: weeks[index - 1] });
    const longDate = available.find(date => date.dow === preferred) ?? available[available.length - 1];

    if (longDate) {
      // Spread running days across the week before filling adjacent days.
      const selected = [longDate];
      while (selected.length < Math.min(maxRunDays, available.length)) {
        const candidates = available.filter(date => !selected.includes(date));
        candidates.sort((a, b) => {
          const gap = (offset: number) => Math.min(...selected.map(date => Math.min(Math.abs(offset - date.offset), 7 - Math.abs(offset - date.offset))));
          return gap(b.offset) - gap(a.offset) || a.offset - b.offset;
        });
        selected.push(candidates[0]);
      }

      let volume = Math.min(weeklyCap, targets.targetWeeklyMin);
      if (previousVolume > 0) {
        volume = Math.min(volume, Math.floor(previousVolume * (meta.deload ? 0.82 : taper ? 0.72 : 1.08)));
      }
      if (raceWeek) volume = Math.min(volume, Math.floor(weeklyCap * 0.3), available.length * 20);
      const longCap = Math.max(10, Math.min(targets.longRunMax, targets.maxSingleRunMin,
        previousLong > 0 && !taper ? previousLong + (meta.deload ? 0 : 10) : Infinity,
        raceWeek ? 20 : taper ? 45 : Infinity));
      // Limited availability reduces volume; never cram missed runs into a mega-session.
      volume = Math.min(volume, longCap * selected.length);
      const longMinutes = Math.min(longCap, volume, Math.max(Math.ceil(volume / selected.length), Math.round(volume * 0.3)));
      const support = selected.filter(date => date !== longDate).sort((a, b) => a.offset - b.offset);
      let remaining = volume - longMinutes;
      let qualityUsed = false;
      const allocations = [{ date: longDate, minutes: longMinutes, long: !raceWeek }, ...support.map((date, i) => {
        const minutes = Math.min(longMinutes, Math.floor(remaining / (support.length - i)));
        remaining -= minutes;
        return { date, minutes, long: false };
      })];
      for (const { date, minutes, long } of allocations) {
        if (minutes < 10) continue;
        const quality: boolean = !long && !qualityUsed && !beginner && !taper && !meta.deload
          && /build|peak/i.test(meta.phase) && minutes >= 30 && Math.abs(date.offset - longDate.offset) > 1;
        qualityUsed ||= quality;
        const workMinutes = quality ? Math.min(15, minutes - 20) : 0;
        const title = raceWeek ? 'Easy Shakeout' : long ? 'Long Run' : quality ? 'Controlled Tempo Run' : 'Easy Run';
        const intensity = quality ? 'Controlled RPE 6/10 during the steady section; easy conversational effort otherwise.' : easyIntensity(userParams);
        const workout = quality
          ? `${minutes}min total: 10min easy, ${workMinutes}min controlled steady running, ${minutes - 10 - workMinutes}min easy cooldown.`
          : `${minutes}min total at conversational effort. Begin and finish gently; use walk breaks as needed.`;
        days[date.iso] = [{ sport: 'run', title, type: long ? 'long_run' : quality ? 'run_quality' : 'run_easy',
          durationMinutes: minutes, priority: long ? 'anchor' : quality ? 'key' : 'support',
          details: `Purpose: ${long ? 'Build aerobic endurance without racing the workout.' : 'Build consistent running with controlled fatigue.'}\nWorkout: ${workout}\nIntensity: ${intensity}\nCoach note: Finish feeling in control; shorten the session if recovery is poor.`,
          intensity }];
      }
    }
    previousVolume = Object.values(days).flat().reduce((sum, session) => sum + (typeof session === 'object' ? session.durationMinutes ?? 0 : 0), 0);
    previousLong = Math.max(0, ...Object.values(days).flat().map(session => typeof session === 'object' ? session.durationMinutes ?? 0 : 0));
    if (raceWeek) {
      // The event is not training volume and has no invented finishing-time target.
      days[userParams.raceDate] = [{ sport: 'other', title: 'Race Day', type: 'race_day', priority: 'anchor',
        details: `Race day for ${userParams.raceType}. Start patiently, follow your practiced pacing and fueling, and adjust to conditions.` }];
    }
    weeks.push({ ...meta, days });
  }
  return weeks;
}
