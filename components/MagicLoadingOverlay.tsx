'use client';

import { useEffect, useMemo, useState } from 'react';

type MagicLoadingOverlayProps = {
  mode: 'plan' | 'strava';
  visible: boolean;
  title?: string;
  subtitle?: string;
  onClose?: () => void;
};

const PLAN_STEPS = [
  'Reading your race goal and training availability',
  'Mapping your week around rest days and constraints',
  'Building the base, build, peak, and taper phases',
  'Placing key swim, bike, run, and brick sessions',
  'Checking the plan for overload, gaps, and race specificity',
  'Preparing your calendar',
];

const STRAVA_STEPS = [
  'Connecting securely to Strava',
  'Reading your recent training history',
  'Separating swim, bike, and run patterns',
  'Looking for volume, consistency, pace, and power signals',
  'Calibrating your training profile',
  'Bringing your activities into TrainGPT',
];

export default function MagicLoadingOverlay({
  mode,
  visible,
  title,
  subtitle,
  onClose,
}: MagicLoadingOverlayProps) {
  const steps = mode === 'strava' ? STRAVA_STEPS : PLAN_STEPS;
  const [activeStep, setActiveStep] = useState(0);
  const [progress, setProgress] = useState(mode === 'strava' ? 12 : 8);

  useEffect(() => {
    if (!visible) {
      setActiveStep(0);
      setProgress(mode === 'strava' ? 12 : 8);
      return;
    }

    const stepTimer = window.setInterval(() => {
      setActiveStep((current) => Math.min(current + 1, steps.length - 1));
    }, mode === 'strava' ? 1050 : 2200);

    const progressTimer = window.setInterval(() => {
      setProgress((current) => {
        const ceiling = mode === 'strava' ? 92 : 94;
        const increment = mode === 'strava' ? 4 : current < 55 ? 3 : 1;
        return Math.min(ceiling, current + increment);
      });
    }, 700);

    return () => {
      window.clearInterval(stepTimer);
      window.clearInterval(progressTimer);
    };
  }, [mode, steps.length, visible]);

  const completedCount = useMemo(() => Math.min(activeStep + 1, steps.length), [activeStep, steps.length]);

  if (!visible) return null;

  const isStrava = mode === 'strava';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#f6f3ee]/95 px-4 backdrop-blur-xl">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-[0_30px_90px_rgba(24,24,27,0.18)]">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-zinc-950/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-amber-200/50 blur-3xl" />

        <div className="relative p-6 sm:p-8">
          <div className="mb-7 flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-[#fbfaf8] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-zinc-950 opacity-30" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-zinc-950" />
                </span>
                {isStrava ? 'Strava sync' : 'Plan engine'}
              </div>
              <h2 className="mt-5 max-w-xl text-3xl font-semibold tracking-[-0.04em] text-zinc-950 sm:text-4xl">
                {title ?? (isStrava ? 'Reading your training history.' : 'Building your training calendar.')}
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-500">
                {subtitle ??
                  (isStrava
                    ? 'We’re turning recent activities into useful training context so your plan feels personal from the start.'
                    : 'We’re turning your race, schedule, and constraints into a structured plan you can actually follow.')}
              </p>
            </div>

            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-500 hover:bg-zinc-50"
              >
                Close
              </button>
            ) : null}
          </div>

          <div className="rounded-[1.5rem] border border-zinc-200 bg-[#fbfaf8] p-4 sm:p-5">
            <div className="flex items-center justify-between text-xs font-semibold text-zinc-500">
              <span>{completedCount}/{steps.length} checks</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-200">
              <div
                className="h-full rounded-full bg-zinc-950 transition-all duration-700 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="mt-5 grid gap-2">
            {steps.map((step, index) => {
              const active = index === activeStep;
              const complete = index < activeStep;

              return (
                <div
                  key={step}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                    active
                      ? 'border-zinc-300 bg-white text-zinc-950 shadow-sm'
                      : complete
                        ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
                        : 'border-zinc-200 bg-white/60 text-zinc-400'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                      complete
                        ? 'bg-emerald-600 text-white'
                        : active
                          ? 'bg-zinc-950 text-white'
                          : 'bg-zinc-100 text-zinc-400'
                    }`}
                  >
                    {complete ? '✓' : index + 1}
                  </span>
                  <span>{step}</span>
                </div>
              );
            })}
          </div>

          <p className="mt-5 text-center text-xs leading-5 text-zinc-400">
            {isStrava
              ? 'You can keep building your plan while this finishes.'
              : 'Longer race plans can take a minute. Keep this tab open.'}
          </p>
        </div>
      </div>
    </div>
  );
}
