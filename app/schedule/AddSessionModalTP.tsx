'use client';

import React from 'react';
import { format } from 'date-fns';
import clsx from 'clsx';
import InlineSessionForm from './InlineSessionForm';

type Props = {
  open: boolean;
  date: Date; // keep exactly what InlineSessionForm expects
  onClose: () => void;
  onAdded?: (row: any) => void;
};

export default function AddSessionModalTP({ open, date, onClose, onAdded }: Props) {
  if (!open) return null;

  const d = new Date(date);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      {/* backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/30"
      />

      {/* modal */}
      <div
        role="dialog"
        aria-modal="true"
        className={clsx(
          'relative w-[92vw] max-w-[760px]',
          'rounded-xl bg-white shadow-2xl'
        )}
      >
        {/* header (TrainingPeaks-like) */}
        <div className="flex items-start justify-between px-8 pb-4 pt-7">
          <div>
            <div className="text-2xl font-semibold tracking-tight text-gray-900">
              {format(d, 'EEEE, MMMM d, yyyy')}
            </div>
            <div className="mt-1 text-sm text-gray-500">
              Add a session to your calendar.
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-gray-500 hover:bg-gray-50 hover:text-gray-800"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* body */}
        <div className="px-8 pb-8">
          {/* This block mirrors TP’s “Add a Workout” section visually,
              but your actual “create” logic stays in InlineSessionForm. */}
          <div className="text-sm font-medium text-gray-900">Add a Workout</div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'Run', icon: '🏃' },
              { label: 'Bike', icon: '🚴' },
              { label: 'Swim', icon: '🏊' },
              { label: 'Brick', icon: '🧱' },
              { label: 'Crosstrain', icon: '⚡' },
              { label: 'Day off', icon: '🛌' },
              { label: 'Strength', icon: '🏋️' },
              { label: 'Custom', icon: '📝' },
            ].map((b) => (
              <div
                key={b.label}
                className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 opacity-70"
                title="Type selection coming soon"
              >
                <span className="text-[15px]">{b.icon}</span>
                <span>{b.label}</span>
              </div>
            ))}
          </div>

          <div className="mt-7 text-sm font-medium text-gray-900">Details</div>

          {/* Here’s your existing form, unchanged */}
          <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50/50">
            <InlineSessionForm
              date={date}
              onClose={onClose}
              onAdded={(row: any) => {
                onAdded?.(row);
                // InlineSessionForm does not auto-close; you control it here.
                onClose();
              }}
            />
          </div>

          {/* Optional “Add Other” row (visual parity only) */}
          <div className="mt-7 text-sm font-medium text-gray-900">Add Other</div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'Event', icon: '🏁' },
              { label: 'Goals', icon: '🎯' },
              { label: 'Note', icon: '📌' },
              { label: 'Metrics', icon: '📈' },
            ].map((b) => (
              <div
                key={b.label}
                className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 opacity-70"
                title="Coming soon"
              >
                <span className="text-[15px]">{b.icon}</span>
                <span>{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
