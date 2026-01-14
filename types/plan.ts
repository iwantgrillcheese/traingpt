// /types/plan.ts

// ----------------- Plan-related types -----------------

// Day-of-week: 0 = Sunday ... 6 = Saturday
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type TrainingPrefs = {
  /** Preferred day for the long ride. Default: 6 (Saturday) */
  longRideDay?: DayOfWeek;
  /** Preferred day for the long run. Default: 0 (Sunday) */
  longRunDay?: DayOfWeek;
  /** Allowed brick day(s). Default: [6] (Saturday). Example override: [0] for Sunday */
  brickDays?: DayOfWeek[];
};

export type PlanType = 'triathlon' | 'running' | 'swim' | 'bike' | 'run';

export type UserParams = {
  raceType: string;         // e.g., "Half Ironman (70.3)"
  raceDate: string;         // ISO date "YYYY-MM-DD"
  experience: 'Beginner' | 'Intermediate' | 'Advanced' | string;
  maxHours: number;         // max training hours per week
  restDay: string;          // e.g., "Monday"

  // Metrics (optional)
  bikeFtp?: number;
  runPace?: string;         // "6:55 / mi"
  swimPace?: string;        // "1:32 / 100m"
  paceUnit?: 'mi' | 'km';

  // Preferences (optional)
  trainingPrefs?: TrainingPrefs;
};

export type WeekMeta = {
  label: string; // "Week 1"
  phase: 'Base' | 'Build' | 'Peak' | 'Taper' | 'Recovery' | string;
  startDate: string; // "YYYY-MM-DD"
  deload: boolean;
};

export type WeekJson = {
  label: string;
  phase: WeekMeta['phase'];
  startDate: string; // "YYYY-MM-DD"
  deload: boolean;
  days: Record<string, string[]>; // map date → session strings
  debug?: string;
};

export type GeneratedPlan = {
  planType: PlanType;
  weeks: WeekJson[];
  params: UserParams;
  createdAt: string; // ISO timestamp
};

// ----------------- Sessions-related types -----------------

export type SessionStatus = 'planned' | 'done' | 'skipped';

export interface Session {
  id?: string;             // Supabase PK
  created_at?: string;     // Supabase default timestamp
  user_id: string;         // FK → profiles.id
  plan_id: string;         // FK → plans.id
  session_date: string;    // ISO "YYYY-MM-DD"
  session_title: string;   // e.g. "Bike 90min Z2 — 3x10min tempo"
  status: SessionStatus;   // planned | done | skipped
  strava_id?: string | null; // linked Strava activity if any
}
