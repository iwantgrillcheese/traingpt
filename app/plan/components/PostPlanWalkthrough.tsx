'use client';

import React from 'react';
import type { WalkthroughContext } from '@/types/coachGuides';
import { shouldShowWalkthrough } from '@/utils/coachGuides/selectors';
import { dismissWalkthrough, isWalkthroughDismissed } from '@/lib/walkthrough-storage';
import CoachWalkthroughModal from './CoachWalkthroughModal';

export default function PostPlanWalkthrough({
  context,
  open,
  onClose,
}: {
  context: WalkthroughContext | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!context) return null;
  if (!open) return null;

  // Guardrails (don’t show if not eligible)
  if (!shouldShowWalkthrough(context)) return null;
  if (isWalkthroughDismissed(context.planId)) return null;

  return (
    <CoachWalkthroughModal
      context={context}
      onClose={onClose}
      onDismissForever={() => {
        dismissWalkthrough(context.planId);
        onClose();
      }}
    />
  );
}
