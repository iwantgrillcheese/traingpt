import type { CoachingContextPayload } from '@/types/coaching-context';

export function encodeCoachingContext(ctx: CoachingContextPayload): string {
  return encodeURIComponent(JSON.stringify(ctx));
}

export function decodeCoachingContext(value: string | null | undefined): CoachingContextPayload | null {
  if (!value) return null;
  try {
    return JSON.parse(decodeURIComponent(value)) as CoachingContextPayload;
  } catch {
    return null;
  }
}

export function buildCoachingPrompt(action: string, ctx: CoachingContextPayload) {
  return [
    action,
    `Session: ${ctx.sessionTitle ?? 'Unknown'}`,
    `Session date: ${ctx.sessionDate ?? 'Unknown'}`,
    `Session type: ${ctx.sessionType ?? 'Unknown'}`,
    `Completion: ${ctx.completionState ?? 'planned'}`,
    `Week: ${ctx.weekLabel ?? 'Unknown'}`,
    `Phase: ${ctx.weekPhase ?? 'Unknown'}`,
    `Recent completed (14d): ${ctx.recentCompleted ?? 0}`,
    `Recent missed (14d): ${ctx.recentMissed ?? 0}`,
    `Race goal: ${ctx.raceGoal ?? 'Not set'}`,
    'Give an execution-focused answer tied to this plan context.',
  ].join('\n');
}

export function buildCoachingHref(action: string, ctx: CoachingContextPayload) {
  const prompt = buildCoachingPrompt(action, ctx);
  return `/coaching?q=${encodeURIComponent(prompt)}&ctx=${encodeCoachingContext(ctx)}`;
}
