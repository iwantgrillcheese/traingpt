export type SessionRow = {
  training_paused?: boolean;
  id: string;
  user_id?: string;
  plan_id?: string | null;
  date: string;
  sport: string | null;
  title: string | null;
  duration: number | null;
  details: string | null;
  structured_workout?: string | null;
  strava_id?: string | null;
};

export type CompletedSessionRow = {
  session_id?: string | null;
  completed_at?: string | null;
  id?: string;
  user_id?: string;
  date: string;
  session_title: string;
  status: 'done' | 'skipped' | string | null;
};

export type StravaActivityRow = {
  id?: string;
  user_id?: string;
  strava_id?: number | string | null;
  name?: string | null;
  sport_type?: string | null;
  start_date?: string | null;
  start_date_local?: string | null;
  moving_time?: number | null;
  distance?: number | null;
};

export type PlanRow = {
  id: string;
  user_id?: string;
  race_type?: string | null;
  race_date?: string | null;
  plan?: any;
};

export type RootTabParamList = {
  Today: undefined;
  Schedule: undefined;
  Coach: undefined;
  Fitness: undefined;
  Settings: undefined;
};
