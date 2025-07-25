export type Session = {
  id: string;
  user_id: string;
  date: string;
  sport: 'Swim' | 'Bike' | 'Run' | 'Rest' | 'Strength' | 'Other';
  title: string;
duration?: number; // if you sometimes expect it
  details: string | null;
  structured_workout: string | null;
  strava_id: string | null;
};
