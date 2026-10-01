export type PauseReason = 'sick' | 'injured' | 'travel' | 'life';
export type TrainingPause = {
  id: string;
  plan_id: string;
  status: 'paused' | 'resumed';
  reason: PauseReason;
  started_at: string;
  started_date: string;
  expected_return_date?: string | null;
  resumed_at?: string | null;
  resumed_date?: string | null;
};

/** Day-granularity pause: resume day is eligible; expected return never resumes automatically. */
export function dateIsPaused(date: string, pauses: TrainingPause[]): boolean {
  return pauses.some(pause => date >= pause.started_date && (!pause.resumed_date || date < pause.resumed_date));
}

export function trainingIsPaused(pauses: TrainingPause[]): boolean {
  return pauses.some(pause => pause.status === 'paused');
}
