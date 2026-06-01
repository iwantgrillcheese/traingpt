// /types/plan.ts

// ----------------- Plan-related types -----------------

// Day-of-week: 0 = Sunday ... 6 = Saturday, or normalized day name.
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6 | string;

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
  experience?: 'Beginner' | 'Intermediate' | 'Advanced' | string;
  maxHours: number;         // max training hours per week
  restDay?: string;         // e.g., "Monday"

  // Metrics (optional)
  bikeFtp?: number;
  bikeFTP?: number;
  runPace?: string;         // "6:55 / mi"
  swimPace?: string;        // "1:32 / 100m"
  paceUnit?: 'mi' | 'km';

  // Preferences (optional)
  trainingPrefs?: TrainingPrefs;

  // Optional Strava context for plan calibration
  stravaHistorySummary?: string;

  // Guided onboarding context. These describe the athlete's real-world constraints.
  preferredLongRideDay?: DayOfWeek;
  preferredLongRunDay?: DayOfWeek;
  unavailableDays?: DayOfWeek[];
  swimComfort?: 'new' | 'developing' | 'comfortable' | 'strong' | string;
  twoADaysAllowed?: boolean;
  athleteNotes?: string;
  coachingPriorities?: string[];
  constraintsSummary?: string;
  preferencesText?: string;
  planType?: PlanType;
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
  days: Record<string, Array<string | { sport?: string; title?: string; details?: string; description?: string; type?: string; durationMinutes?: number; duration?: number; priority?: string; purpose?: string; intensity?: string; coachNote?: string }>>; // map date → session strings or structured session objects
  debug?: string;
};

export type GeneratedPlan = {
  planType: PlanType;
  weeks: WeekJson[];
  days?: Record<string, any[]>;
  params: UserParams;
  createdAt?: string; // ISO timestamp
  metadata?: {
    generatedAt?: string;
    totalWeeks?: number;
    source?: string;
    stravaCalibrated?: boolean;
    [key: string]: unknown;
  };
};

// ----------------- Sessions-related types -----------------

export type SessionStatus = 'planned' | 'done' | 'skipped';

export interface Session {
  id?: string;             // Supabase PK
  created_at?: string;     // Supabase default timestamp
  user_id: string;         // FK → profiles.id
  plan_id: string;         // FK → plans.id
  date: string;            // ISO date "YYYY-MM-DD"
  sport: string;           // swim | bike | run | strength | rest
  title: string;           // "Easy Run", "Bike Intervals"
  duration?: number;       // minutes
  details?: string;        // session description / coach note
  status?: SessionStatus;
  structured_workout?: any;
}
