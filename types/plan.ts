// /types/plan.ts

export type RaceType = 'Sprint' | 'Olympic' | 'Half Ironman (70.3)' | 'Ironman (140.6)';

export type UserParams = {
  raceType: RaceType;
  raceDate: Date;
  startDate: Date;
  totalWeeks: number;
  experience: string;
  maxHours: number;
  restDay: string;
  bikeFTP?: number | null;
  runPace?: string | null;
  swimPace?: string | null;
  userNote?: string;
};

export type WeekMeta = {
  label: string;
  phase: string;
  deload: boolean;
  startDate: string; // 'yyyy-MM-dd'
};

export type Session = {
  sport: 'Swim' | 'Bike' | 'Run' | 'Rest' | string;
  title: string;
  description?: string;
  duration?: string;
  intensity?: string;
  [key: string]: any;
};
