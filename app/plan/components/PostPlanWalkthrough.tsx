'use client';

import React, { useEffect, useState } from 'react';
import type { WalkthroughContext } from '@/types/coachGuides';
import { shouldShowWalkthrough } from '@/utils/coachGuides/selectors';
import { dismissWalkthrough, isWalkthroughDismissed } from '@/lib/walkthrough-storage';
import CoachWalkthroughModal from './CoachWalkthroughModal';

export default function PostPlanWalkthrough({
  context,
  forceOpen = false,
}: {
  context: WalkthroughContext | null;
  forceOpen?: boolean;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!context) return;
    if (open) return;

    const ok = shouldShowWalkthrough(context);
    const dismissed = isWalkthroughDismissed(context.planId);

    if (!ok || dismissed) return;

    // Open if explicitly forced (planReady) OR if simply eligible
    if (forceOpen || true) {
      setOpen(true);
    }
  }, [context?.planId, forceOpen, open, context]);

  if (!context || !open) return null;

  return (
    <CoachWalkthroughModal
      context={context}
      onClose={() => setOpen(false)}
      onDismissForever={() => dismissWalkthrough(context.planId)}
    />
  );
}
