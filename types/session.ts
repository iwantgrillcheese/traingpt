export type Sport = 'Swim' | 'Bike' | 'Run' | 'Rest' | 'Strength';

export type Session = {
  id: string;
  user_id: string;
  date: string;
  title: string;
  sport: string;
  details?: string | null;
  status?: string;
  strava_id?: string | null; // ← add this line
};

