'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
  const eligible = useMemo(() => {
    if (!context) return false;
    if (!shouldShowWalkthrough(context)) return false;
    if (isWalkthroughDismissed(context.planId)) return false;
    return true;
  }, [context]);

  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!context) return;
    if (forceOpen && shouldShowWalkthrough(context) && !isWalkthroughDismissed(context.planId)) {
      setOpen(true);
      return;
    }
    if (eligible) setOpen(true);
  }, [eligible, context, forceOpen]);

  if (!context) return null;
  if (!open) return null;

  return (
    <CoachWalkthroughModal
      context={context}
      onClose={() => setOpen(false)}
      onDismissForever={() => dismissWalkthrough(context.planId)}
    />
  );
}
