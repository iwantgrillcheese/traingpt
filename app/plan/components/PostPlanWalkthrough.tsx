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

  const isManual = context.mode === 'manual';

  // Guardrails:
  // - auto: beginners only + respects dismissal
  // - manual: user explicitly opened; ignore beginner/dismiss restrictions
  if (!isManual) {
    if (!shouldShowWalkthrough(context)) return null;
    if (isWalkthroughDismissed(context.planId)) return null;
  }

  return (
    <CoachWalkthroughModal
      context={context}
      onClose={onClose}
      onDismissForever={() => {
        // Only persist dismissal for auto mode.
        // If user manually opens, "Skip" should just close it, not permanently hide.
        if (!isManual) {
          dismissWalkthrough(context.planId);
        }
        onClose();
      }}
    />
  );
}
