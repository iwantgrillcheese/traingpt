export type StravaActivity = {
  id: string;
  user_id: string;
  strava_id: number;
  name: string;
  sport_type: 'Run' | 'Ride' | 'Swim' | 'Walk' | 'Workout' | 'Hike' | string;
  start_date: string; // ISO string
  start_date_local: string;
  moving_time: number; // in seconds
  distance: number; // in meters
  manual: boolean;
  created_at: string;
  average_heartrate: number | null;
  max_heartrate: number | null;
  average_speed: number | null; // meters per second
  average_watts: number | null;
  weighted_average_watts: number | null;
  kilojoules: number | null;
  total_elevation_gain: number | null;
  device_watts: boolean | null;
  trainer: boolean | null;
  local_date?: string;
};
