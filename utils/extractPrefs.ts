// utils/extractPrefs.ts
import type { TrainingPrefs, DayOfWeek } from '@/types/plan';

const DAY_MAP: Record<string, DayOfWeek> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

function findDay(text: string): DayOfWeek | undefined {
  const m = text.match(/\b(sun(day)?|mon(day)?|tue(s(day)?)?|wed(nesday)?|thu(r(s(day)?)?)?|fri(day)?|sat(urday)?)\b/i);
  if (!m) return;
  return DAY_MAP[m[0].toLowerCase()];
}

/** Lightweight rule-based extractor for preferences mentioned in a free-form box. */
export function extractPrefs(freeform?: string): TrainingPrefs | undefined {
  if (!freeform) return undefined;
  const text = freeform.toLowerCase();

  const prefs: TrainingPrefs = {};

  // Brick day(s)
  if (/(brick|bike-?run)/i.test(text)) {
    const d = findDay(text);
    if (d !== undefined) prefs.brickDays = [d];
  }

  // Long ride
  if (/long ride/i.test(text)) {
    const d = findDay(text);
    if (d !== undefined) prefs.longRideDay = d;
  }

  // Long run
  if (/long run/i.test(text)) {
    const d = findDay(text);
    if (d !== undefined) prefs.longRunDay = d;
  }

  // Allow mid-week brick (Wed)
  if (/mid[- ]?week brick|wednesday brick|wed brick/i.test(text)) {
    const base = prefs.brickDays ?? [];
    if (!base.includes(3)) prefs.brickDays = [...base, 3];
  }

  if (!prefs.longRideDay && !prefs.longRunDay && !prefs.brickDays) return undefined;
  return prefs;
}
