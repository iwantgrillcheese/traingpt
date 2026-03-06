export type CoachingContextPayload = {
  source?: 'schedule' | 'session' | 'coaching';
  sessionId?: string | null;
  sessionTitle?: string | null;
  sessionType?: string | null;
  sessionDate?: string | null;
  weekLabel?: string | null;
  weekPhase?: string | null;
  completionState?: 'planned' | 'done' | 'skipped' | 'missed';
  recentCompleted?: number;
  recentMissed?: number;
  raceGoal?: string | null;
};
