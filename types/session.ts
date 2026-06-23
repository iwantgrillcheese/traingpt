export type SportType = 'Swim' | 'Bike' | 'Run' | 'Rest' | 'Strength' | 'Other';

export type CoachResponseStatus = string | null;

export type Session = {
  id: string;
  user_id: string;
  plan_id?: string | null;
  date: string;
  sport: SportType;
  title: string;
  duration?: number | null;
  details: string | null;
  purpose?: string | null;
  intensity?: string | null;
  coach_note?: string | null;
  structured_workout: string | null;
  athlete_notes?: string | null;
  coach_response?: string | null;
  coach_response_status?: CoachResponseStatus;
  coach_response_generated_at?: string | null;
  coach_response_note_snapshot?: string | null;
  strava_id: number | null;
};

export type CompletedSession = {
  date: string;
  session_title: string;
  status?: 'done' | 'skipped';
};
