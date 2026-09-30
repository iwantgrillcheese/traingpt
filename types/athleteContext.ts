export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export type DayName = typeof WEEKDAYS[number];
export const SPORTS = ['swim', 'bike', 'run', 'strength'] as const;
export type ContextSport = typeof SPORTS[number];
export const CONTEXT_RACES = ['Sprint', 'Olympic', 'Half Ironman (70.3)', 'Ironman (140.6)', '5k', '10k', 'Half Marathon', 'Marathon'] as const;
export type ConstraintStrength = 'hard' | 'preference' | 'context';
export type RecurringCommitment = { day: DayName; activity: string; intensity?: 'easy' | 'moderate' | 'hard' };
export type InterpretedAthleteContext = {
  sportAvailability?: Partial<Record<ContextSport, DayName[]>>;
  unavailableDays?: DayName[];
  restDay?: DayName;
  preferredLongRunDay?: DayName;
  preferredLongRideDay?: DayName;
  avoidHardTrainingDays?: DayName[];
  recurringCommitments?: RecurringCommitment[];
  twoADaysAllowed?: boolean;
  secondaryEvent?: { raceType: typeof CONTEXT_RACES[number]; raceDate?: string | null };
  preferences?: Array<{ text: string; strength: 'preference' | 'context' }>;
  unsupportedRequests?: string[];
};
/** Source and confirmation travel with plan params; future revisions can be applied to future weeks. */
export type ConfirmedAthleteContext = {
  version: 1;
  sourceNotes: string;
  confirmedAt: string;
  context: InterpretedAthleteContext;
};
