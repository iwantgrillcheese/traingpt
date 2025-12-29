import type { CoachGuide, WalkthroughContext } from '@/types/coachGuides';
import { COACH_GUIDES } from './guides';

function normalizeExperience(
  exp?: string | null
): 'beginner' | 'intermediate' | 'advanced' | 'unknown' {
  if (!exp) return 'unknown';
  const v = exp.trim().toLowerCase();
  if (v.startsWith('beg')) return 'beginner';
  if (v.startsWith('int')) return 'intermediate';
  if (v.startsWith('adv')) return 'advanced';
  return 'unknown';
}

export function shouldShowWalkthrough(ctx: WalkthroughContext): boolean {
  // V1 rule: show for beginners. If experience missing/unknown, do not force it.
  return normalizeExperience(ctx.experience) === 'beginner';
}

export function getGuidesForContext(ctx: WalkthroughContext): CoachGuide[] {
  const exp = normalizeExperience(ctx.experience);
  const raceType = ctx.raceType ?? undefined;
  const isManual = ctx.mode === 'manual';

  const filtered = COACH_GUIDES.filter((g) => {
    const app = g.applicableTo;
    if (!app) return true;

    // Experience filtering:
    // - auto mode: enforce experience applicability
    // - manual mode: user explicitly opened; do NOT filter out based on experience
    if (!isManual && app.experience && exp !== 'unknown') {
      const okExp = app.experience.includes(exp) || app.experience.includes('any');
      if (!okExp) return false;
    }

    if (app.raceTypes && raceType) {
      if (!app.raceTypes.includes(raceType)) return false;
    }

    return true;
  });

  return filtered.sort((a, b) => b.priority - a.priority).slice(0, 6);
}
