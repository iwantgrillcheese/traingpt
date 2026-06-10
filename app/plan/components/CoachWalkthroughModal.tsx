'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { WalkthroughContext } from '@/types/coachGuides';
import { getGuidesForContext } from '@/utils/coachGuides/selectors';
import CoachGuideCard from './CoachGuideCard';

export default function CoachWalkthroughModal({
  context,
  onClose,
  onDismissForever,
}: {
  context: WalkthroughContext;
  onClose: () => void;
  onDismissForever: () => void;
}) {
  const router = useRouter();
  const guides = useMemo(() => getGuidesForContext(context), [context]);
  const [index, setIndex] = useState(0);

  const guide = guides[index];
  const raceLabel = context.raceType ?? 'your race';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />

      <div
        className="
          relative w-full max-w-2xl
          max-h-[85vh] md:max-h-[80vh]
          rounded-3xl border border-zinc-200 bg-white shadow-xl
          overflow-hidden
          flex flex-col
        "
      >
        {/* Header (fixed) */}
        <div className="px-6 pt-6 pb-4 border-b border-zinc-100 shrink-0">
          <div className="text-xs font-medium text-zinc-500">Coach Walkthrough</div>
          <div className="mt-1 text-xl font-semibold tracking-tight text-zinc-900">
            Walkthrough for {raceLabel}
          </div>
          <div className="mt-2 text-sm text-zinc-600">
            This is a 3–5 minute walkthrough to make sure you feel confident before week 1.
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-xs text-zinc-500">
              {index + 1} of {guides.length}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  onDismissForever();
                  router.push('/schedule');
                }}
                className="text-sm px-4 py-2 rounded-full bg-black text-white hover:bg-zinc-800 transition"
              >
                Continue to Schedule
              </button>
              <button
                type="button"
                onClick={() => {
                  onDismissForever();
                  onClose();
                }}
                className="text-sm px-4 py-2 rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 transition"
              >
                Skip
              </button>
            </div>
          </div>
        </div>

        {/* Body (scrollable on mobile) */}
        <div
          className="px-6 py-6 overflow-y-auto overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {guide ? (
            <CoachGuideCard
              guide={guide}
              onCTA={(cta) => {
                if (cta.type === 'go_schedule') {
                  router.push('/schedule');
                  return;
                }
                if (cta.type === 'open_coaching') {
                  const q = encodeURIComponent(cta.prompt ?? '');
                  router.push(`/coaching?q=${q}`);
                  return;
                }
              }}
            />
          ) : (
            <div className="text-sm text-zinc-600">No guides available.</div>
          )}

          <div className="mt-5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="text-sm px-4 py-2 rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-40 transition"
            >
              Back
            </button>

            <button
              type="button"
              onClick={() => setIndex((i) => Math.min(guides.length - 1, i + 1))}
              disabled={index >= guides.length - 1}
              className="text-sm px-4 py-2 rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-40 transition"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
