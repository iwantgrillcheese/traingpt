export type StravaActivity = {
  id: string;
  user_id: string;
  session_id?: string;
  date: string;
  name: string;
  sport: 'Swim' | 'Bike' | 'Run' | 'Other';
  distance_km?: number;      // e.g. 42.2
  avg_pace?: string;         // e.g. "5:15 / km"
  avg_power?: number;        // e.g. 210 (watts)
  avg_hr?: number;           // e.g. 155 (bpm)
  created_at?: string;
};
