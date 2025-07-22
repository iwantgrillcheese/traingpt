export type RaceType =
  | '5k'
  | '10k'
  | 'Half Marathon'
  | 'Marathon'
  | 'Sprint'
  | 'Olympic'
  | 'Half Ironman (70.3)'
  | 'Ironman (140.6)';

export type PlanType = 'running' | 'triathlon';

export type UserParams = {
  raceType: RaceType;
  raceDate: Date;
  startDate: Date;
  totalWeeks: number;
  experience: string;
  maxHours: number;
  restDay: string;
  userNote?: string;

  // Optional metrics
  bikeFTP?: number | null;
  runPace?: string | null;  // formatted like "7:30"
  swimPace?: string | null; // formatted like "1:50"
};

export type WeekMeta = {
  label: string;     // e.g. "Week 5"
  phase: string;     // e.g. "Build", "Taper", "Race Week"
  deload: boolean;
  startDate: string; // "yyyy-MM-dd"
};

export type Week = WeekMeta & {
  days: Record<string, string[]>; // e.g. "2025-07-22": ["🏃 Run: 40min Z2"]
};
