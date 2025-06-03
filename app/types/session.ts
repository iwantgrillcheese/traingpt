// types/session.ts

export type SessionStatus =
  | 'planned'
  | 'done'
  | 'skipped'
  | 'missed'
  | 'not_started';

export type Session = {
  id: string;
  user_id: string;
  plan_id: string;
  date: string;
  sport: 'swim' | 'bike' | 'run' | 'rest';
  label: string;
  status: SessionStatus | null;
  structured_workout?: string | null;
  user_note?: string | null;
};
