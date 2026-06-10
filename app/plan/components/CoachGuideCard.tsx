'use client';

import React from 'react';
import type { CoachGuide, CoachCTA } from '@/types/coachGuides';
import CoachResourceList from './CoachResourceList';

export default function CoachGuideCard({
  guide,
  onCTA,
}: {
  guide: CoachGuide;
  onCTA: (cta: CoachCTA) => void;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
      <div className="text-lg font-semibold tracking-tight text-zinc-900">{guide.title}</div>
      <div className="mt-2 text-sm leading-relaxed text-zinc-700">{guide.body}</div>

      {guide.resources?.length ? <CoachResourceList resources={guide.resources} /> : null}

      {guide.ctas?.length ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {guide.ctas.map((cta) => (
            <button
              key={cta.label}
              type="button"
              onClick={() => onCTA(cta)}
              className="text-sm px-4 py-2 rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 transition"
            >
              {cta.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
