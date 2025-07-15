// /utils/getNextMonday.ts
import { addDays } from 'date-fns';

export function getNextMonday(date: Date) {
  const day = date.getDay();
  const diff = (8 - day) % 7;
  return addDays(date, diff);
}
