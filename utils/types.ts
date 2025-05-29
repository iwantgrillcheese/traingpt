export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  swim_threshold_per_100m?: number;
  bike_ftp?: number;
  run_threshold_per_mile?: number;
  max_training_hours?: number;
  updated_at?: string;
}
