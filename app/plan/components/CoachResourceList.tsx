'use client';

import React from 'react';
import type { CoachResource } from '@/types/coachGuides';

const kindLabel: Record<string, string> = {
  budget: 'Budget',
  safe: 'Safest',
  convenient: 'Convenient',
};

export default function CoachResourceList({ resources }: { resources: CoachResource[] }) {
  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-xs font-medium text-gray-500 mb-3">Recommended places</div>
      <div className="space-y-2">
        {resources.map((r, idx) => (
          <a
            key={`${r.href}-${idx}`}
            href={r.href}
            target="_blank"
            rel="noreferrer"
            className="block rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50 transition"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-gray-900">{r.label}</div>
              <div className="text-[11px] px-2 py-0.5 rounded-full border border-gray-200 text-gray-600">
                {kindLabel[r.kind] ?? r.kind}
              </div>
            </div>
            {r.note ? <div className="text-xs text-gray-500 mt-1">{r.note}</div> : null}
          </a>
        ))}
      </div>
    </div>
  );
}
