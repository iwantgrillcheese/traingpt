const keyForPlan = (planId: string) => `traingpt.walkthrough.dismissed.${planId}`;

export function isWalkthroughDismissed(planId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(keyForPlan(planId)) === '1';
  } catch {
    return false;
  }
}

export function dismissWalkthrough(planId: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(keyForPlan(planId), '1');
  } catch {
    // ignore
  }
}
