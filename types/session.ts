export type SportType = 'Swim' | 'Bike' | 'Run' | 'Rest' | 'Strength' | 'Other';

export type Session = {
  id: string;
  user_id: string;
  plan_id?: string | null;
  date: string;
  sport: SportType;
  title: string;
  duration?: number | null;
  details: string | null;
  structured_workout: string | null;
  strava_id: number | null;
};

export type CompletedSession = {
  date: string;
  session_title: string;
  strava_id?: string;
  session_id?: string | null;
  status?: 'done' | 'skipped';
};
