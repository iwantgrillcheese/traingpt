export type SessionRow = {
  id: string;
  user_id?: string;
  plan_id?: string | null;
  date: string;
  sport: string | null;
  title: string | null;
  duration: number | null;
  details: string | null;
  structured_workout?: string | null;
};

export type CompletedSessionRow = {
  id?: string;
  user_id?: string;
  date: string;
  session_title: string;
  status: 'done' | 'skipped' | string | null;
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
  Progress: undefined;
  Settings: undefined;
};
