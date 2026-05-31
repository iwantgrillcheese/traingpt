'use client';

import React from 'react';
import type { WalkthroughContext } from '@/types/coachGuides';
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

  // The automatic post-generation moment is now handled by PlanReadyReviewOverlay.
  // Keep this walkthrough available only when the athlete manually opens it from Schedule.
  if (context.mode !== 'manual') return null;

  return (
    <CoachWalkthroughModal
      context={context}
      onClose={onClose}
      onDismissForever={onClose}
    />
  );
}
