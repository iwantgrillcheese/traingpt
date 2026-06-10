// /mobile/src/utils/enrichPlan.ts
//
// Closes the iOS gap created by scaffold-first generation: plans created from
// the phone now run the same background enrichment loop the web client does.
// The plan is fully usable immediately (scaffold details are complete); this
// pass upgrades session details week by week while the app stays open. If the
// app is closed mid-run, remaining weeks keep their scaffold details — which
// are executable — and a newer plan generation supersedes any running loop.

import { apiFetch } from '../lib/api';

let activeFor: string | null = null;

export async function enrichPlanInBackground({
  planId,
  totalWeeks,
  userId,
}: {
  planId: string;
  totalWeeks: number;
  userId: string;
}): Promise<void> {
  if (!planId || !Number.isFinite(totalWeeks) || totalWeeks <= 0 || !userId) return;
  if (activeFor === planId) return;

  activeFor = planId;

  try {
    for (let weekIndex = 0; weekIndex < totalWeeks; weekIndex++) {
      if (activeFor !== planId) return; // superseded by a newer plan

      try {
        await apiFetch('/api/enrich-week', {
          method: 'POST',
          body: JSON.stringify({ planId, weekIndex, clientUserId: userId }),
        });
      } catch (error) {
        // Per-week failures are non-fatal; scaffold details remain complete.
        console.error('[enrichPlan] week failed, continuing', { planId, weekIndex, error });
      }
    }
  } finally {
    if (activeFor === planId) activeFor = null;
  }
}
