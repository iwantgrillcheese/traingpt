// /lib/enrichmentRunner.ts
//
// Client-side runner that progressively enriches a freshly generated
// (scaffold-first) triathlon plan. Called fire-and-forget right after
// /api/finalize-plan returns, then keeps working while the user is
// routed to /schedule — Next.js client navigation keeps the JS context
// alive, so the sequential loop survives the redirect.
//
// Progress is broadcast as window CustomEvents so any screen (schedule,
// today view) can show a subtle "Coach is detailing week 4 of 16" pill
// and refresh sessions as weeks complete:
//
//   window.addEventListener('traingpt:week-enriched', (e) => { ... })
//   window.addEventListener('traingpt:enrichment-complete', (e) => { ... })

'use client';

import { supabase } from '@/lib/supabase/client';

export type EnrichmentProgressDetail = {
  planId: string;
  weekIndex: number;
  totalWeeks: number;
  enrichedCount: number;
};

let activeRunFor: string | null = null;

function broadcast(name: string, detail: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch {
    // Non-fatal: progress UI is optional.
  }
}

export function isEnrichmentRunning(planId?: string) {
  return planId ? activeRunFor === planId : activeRunFor !== null;
}

export async function startPlanEnrichment({
  planId,
  totalWeeks,
}: {
  planId: string;
  totalWeeks: number;
}): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!planId || !Number.isFinite(totalWeeks) || totalWeeks <= 0) return;
  if (activeRunFor === planId) return; // already running for this plan

  activeRunFor = planId;

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const userId = session?.user?.id;
    if (!userId) {
      activeRunFor = null;
      return;
    }

    for (let weekIndex = 0; weekIndex < totalWeeks; weekIndex++) {
      // A newer plan generation supersedes this run.
      if (activeRunFor !== planId) return;

      try {
        const res = await fetch('/api/enrich-week', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId, weekIndex, clientUserId: userId }),
        });

        const json = await res.json().catch(() => null);

        broadcast('traingpt:week-enriched', {
          planId,
          weekIndex,
          totalWeeks,
          enrichedCount: Number(json?.enrichedCount ?? 0),
        } satisfies EnrichmentProgressDetail);
      } catch (error) {
        // Per-week failures are non-fatal: the scaffold details for that week
        // are already complete and executable. Continue with the next week.
        console.error('[enrichmentRunner] week failed, continuing', { planId, weekIndex, error });
      }
    }

    broadcast('traingpt:enrichment-complete', { planId, totalWeeks });
  } finally {
    if (activeRunFor === planId) activeRunFor = null;
  }
}
