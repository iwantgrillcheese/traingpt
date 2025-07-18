export type Sport = 'Swim' | 'Bike' | 'Run' | 'Rest' | 'Strength';

export type Session = {
  id: string;
  user_id: string;
  date: string;
  sport: Sport | string; // or just `Sport` if you're strict
  title: string;
  details?: string | null;
  created_at?: string;
};
