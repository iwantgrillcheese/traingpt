export type Sport = 'Swim' | 'Bike' | 'Run' | 'Rest' | 'Strength';

export type Session = {
  id: string;
  date: string;
  text: string; // this is the workout description
  sport?: string;
  title?: string; // optional — some legacy plans might have this
  details?: string | null;
  status?: string;
  strava_id?: string | null; // ← add this line
};

