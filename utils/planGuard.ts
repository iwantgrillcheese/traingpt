// utils/planGuard.ts
import { format } from 'date-fns';
import type { TrainingPrefs, DayOfWeek, WeekJson } from '@/types/plan';

const toDow = (d: string) => new Date(d).getDay() as DayOfWeek;
const moveToDow = (date: string, dow: DayOfWeek) => {
  const dt = new Date(date);
  const delta = ((dow - dt.getDay()) + 7) % 7;
  dt.setDate(dt.getDate() + delta);
  return format(dt, 'yyyy-MM-dd');
};

const ensureDesc = (s: string) =>
  s.includes(' — ') ? s : s.replace(': ', ' — ').replace(/^(.+?)$/, '$1 — Details');

export function guardWeek(week: WeekJson, prefs?: TrainingPrefs): WeekJson {
  // Defaults if no prefs provided
  const longRideDay: DayOfWeek = prefs?.longRideDay ?? 6; // Sat (unused for now, reserved for future longest-ride snap)
  const longRunDay: DayOfWeek  = prefs?.longRunDay  ?? 0; // Sun (unused for now, reserved for future longest-run snap)
  const brickAllowed = new Set<DayOfWeek>(
    (prefs?.brickDays?.length ? prefs.brickDays : [6]) as DayOfWeek[] // default Sat brick
  );

  const kept: Record<string, string[]> = {};

  for (const [date, items] of Object.entries(week.days)) {
    const dow = toDow(date);
    const next: string[] = [];

    for (let s of items) {
      s = ensureDesc(s);
      const t = s.toLowerCase();

      // Brick: must be on an allowed day
      if (t.includes('brick') && !brickAllowed.has(dow)) {
        const nd = moveToDow(date, [...brickAllowed][0] ?? 6);
        kept[nd] = [...(kept[nd] ?? []), s];
        continue; // drop from original date
      }

      // Strength: Tue/Thu only in Base/Build
      if (t.includes('strength') && (week.phase === 'Base' || week.phase === 'Build') && !(dow === 2 || dow === 4)) {
        const nd = moveToDow(date, 2); // Tue
        kept[nd] = [...(kept[nd] ?? []), s];
        continue;
      }

      next.push(s);
    }

    kept[date] = [...(kept[date] ?? []), ...next];
  }

  week.days = kept;
  return week;
}
