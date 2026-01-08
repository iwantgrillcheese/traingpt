'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import InlineSessionForm from './InlineSessionForm';

type WorkoutType =
  | 'run'
  | 'bike'
  | 'swim'
  | 'brick'
  | 'crosstrain'
  | 'dayoff'
  | 'strength'
  | 'custom';

type Props = {
  open: boolean;
  date: Date; // keep as Date (you pass dateObj from DayCell)
  onClose: () => void;
  onAdded?: (row: any) => void;
};

function IconX(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
      <path
        d="M5 5l10 10M15 5L5 15"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconRun(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
      <path
        d="M9 4.5a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M8.4 8.6l2.7 1.4 1.2 2.4m-6.8 2.8 2.3-3.1 2.4-.2 1.9 3.6M4.2 12.6l2.4-2.7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBike(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
      <path
        d="M6 14.8a2.7 2.7 0 1 1 0-5.4 2.7 2.7 0 0 1 0 5.4Zm9.2 0a2.7 2.7 0 1 1 0-5.4 2.7 2.7 0 0 1 0 5.4Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M6 12.1h3.1l2.2-4.3h2.5M9.1 12.1l2.7 2.7M10.2 7.8H8.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSwim(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
      <path
        d="M8.8 6.5a1.8 1.8 0 1 0-3.6 0 1.8 1.8 0 0 0 3.6 0Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M9.7 9.2l2.4 1.1 2.3-.8M6.4 10.1l3.3-.9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M2.8 14.7c1.4 0 1.7-.8 3.1-.8s1.7.8 3.1.8 1.7-.8 3.1-.8 1.7.8 3.1.8 1.7-.8 3.1-.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconBrick(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
      <path
        d="M4 6.5h12v7H4v-7Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M7 6.5v7M13 6.5v7M4 10h12"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconBolt(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
      <path
        d="M11 2.8 5.6 11h4.1l-.7 6.2 5.4-8.2h-4.1L11 2.8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBed(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
      <path
        d="M3.5 10.2V8.4c0-1 1-1.9 2.2-1.9h8.6c1.2 0 2.2.8 2.2 1.9v1.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M3.5 10.2h13v4.1M3.5 14.3v1.6M16.5 14.3v1.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconStrength(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
      <path
        d="M5.2 8.2h1.3v3.6H5.2M13.5 8.2h1.3v3.6h-1.3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M6.5 10h7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M3.8 8.6v2.8M16.2 8.6v2.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconPencil(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" {...props}>
      <path
        d="M4.5 15.5h3.2L16 7.2 12.8 4 4.5 12.3v3.2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M11.7 5.1 14.9 8.3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

const TYPE_OPTIONS: Array<{
  type: WorkoutType;
  label: string;
  Icon: (p: React.SVGProps<SVGSVGElement>) => JSX.Element;
  hint: string;
}> = [
  { type: 'run', label: 'Run', Icon: IconRun, hint: 'Intervals, tempo, easy' },
  { type: 'bike', label: 'Bike', Icon: IconBike, hint: 'Endurance, FTP, ride' },
  { type: 'swim', label: 'Swim', Icon: IconSwim, hint: 'Technique, aerobic' },
  { type: 'brick', label: 'Brick', Icon: IconBrick, hint: 'Bike + run combo' },
  { type: 'crosstrain', label: 'Crosstrain', Icon: IconBolt, hint: 'Yoga, mobility' },
  { type: 'dayoff', label: 'Day off', Icon: IconBed, hint: 'Recovery' },
  { type: 'strength', label: 'Strength', Icon: IconStrength, hint: 'Gym, core' },
  { type: 'custom', label: 'Custom', Icon: IconPencil, hint: 'Anything else' },
];

export default function AddSessionModalTP({ open, date, onClose, onAdded }: Props) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [selectedType, setSelectedType] = useState<WorkoutType>('run');

  const d = useMemo(() => new Date(date), [date]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    // focus the panel for accessibility (without stealing from input later)
    requestAnimationFrame(() => {
      panelRef.current?.focus();
    });
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/35"
        onMouseDown={(e) => {
          // click-outside closes
          if (e.target === e.currentTarget) onClose();
        }}
      />

      {/* Modal */}
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className={[
          'relative w-full max-w-[980px]',
          'rounded-2xl bg-white',
          'shadow-[0_24px_80px_rgba(0,0,0,0.25)]',
          'border border-black/10',
          'overflow-hidden',
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-8 py-6 border-b border-black/10 bg-white">
          <div>
            <div className="text-[22px] font-semibold tracking-tight text-zinc-950">
              {format(d, 'EEEE, MMMM d, yyyy')}
            </div>
            <div className="mt-1 text-sm text-zinc-500">
              Add a session to your calendar.
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-black/10 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
            aria-label="Close modal"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        {/* Body: 2-column layout like TP (left types, right details) */}
        <div className="grid grid-cols-1 md:grid-cols-[360px_1fr]">
          {/* Left: Workout types */}
          <div className="border-b md:border-b-0 md:border-r border-black/10 bg-zinc-50/60 p-6">
            <div className="text-[12px] font-semibold uppercase tracking-wide text-zinc-600">
              Add a Workout
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {TYPE_OPTIONS.map(({ type, label, Icon, hint }) => {
                const active = selectedType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSelectedType(type)}
                    className={[
                      'group w-full rounded-xl border text-left transition',
                      active
                        ? 'border-zinc-900 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)]'
                        : 'border-black/10 bg-white/70 hover:bg-white',
                      'px-3 py-3',
                    ].join(' ')}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={[
                          'inline-flex h-8 w-8 items-center justify-center rounded-lg border',
                          active ? 'border-zinc-900/10 bg-zinc-50' : 'border-black/10 bg-white',
                        ].join(' ')}
                      >
                        <Icon className="h-4 w-4 text-zinc-800" />
                      </span>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-zinc-950">
                          {label}
                        </div>
                        <div className="text-[11px] text-zinc-500 line-clamp-1">
                          {hint}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 rounded-xl border border-black/10 bg-white p-4">
              <div className="text-[12px] font-semibold text-zinc-900">Tip</div>
              <div className="mt-1 text-[12px] leading-relaxed text-zinc-500">
                Keep sessions short and specific. You can add structure later.
              </div>
            </div>
          </div>

          {/* Right: Details + existing form */}
          <div className="p-6">
            <div className="text-[12px] font-semibold uppercase tracking-wide text-zinc-600">
              Details
            </div>

            <div className="mt-4 rounded-2xl border border-black/10 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
              <div className="px-5 py-4 border-b border-black/10">
                <div className="text-sm font-semibold text-zinc-950">
                  Session title
                </div>
                <div className="mt-1 text-[12px] text-zinc-500">
                  Selected: <span className="font-medium text-zinc-800">{selectedType}</span>
                </div>
              </div>

              {/* Your existing insert logic stays here */}
              <div className="p-3 sm:p-4">
                <InlineSessionForm
                  date={date as any}
                  onClose={onClose}
                  onAdded={(row: any) => {
                    onAdded?.(row);
                    onClose();
                  }}
                />
              </div>
            </div>

            {/* (Optional) “Add Other” parity row */}
            <div className="mt-6">
              <div className="text-[12px] font-semibold uppercase tracking-wide text-zinc-600">
                Add Other
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {['Event', 'Goals', 'Note', 'Metrics'].map((label) => (
                  <button
                    key={label}
                    type="button"
                    className="rounded-xl border border-black/10 bg-white px-3 py-2 text-[13px] font-medium text-zinc-700 hover:bg-zinc-50"
                    title="Coming soon"
                    onClick={() => {}}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 text-[12px] text-zinc-500">
              Press <span className="font-medium text-zinc-800">Esc</span> to close.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
