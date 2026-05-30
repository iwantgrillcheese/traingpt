'use client';

import { useEffect, useMemo, useState } from 'react';
import ActivitySignalCards from './ActivitySignalCards';

type MagicLoadingOverlayProps = {
  mode: 'plan' | 'strava';
  visible: boolean;
  title?: string;
  subtitle?: string;
  onClose?: () => void;
};

const PLAN_STEPS = [
  'Reading your goal, race date, and available training time',
  'Mapping constraints across your weekly schedule',
  'Building base, build, peak, and taper blocks',
  'Placing long rides, long runs, recovery, and key sessions',
  'Checking for overload, gaps, and weird stacking',
  'Finalizing your calendar view',
];

const STRAVA_STEPS = [
  'Connecting securely to Strava',
  'Importing recent swim, bike, and run activity',
  'Finding your biggest training days',
  'Pulling out PR-style moments',
  'Estimating starting swim, bike, and run targets',
  'Getting your plan inputs ready',
];

const PLAN_SIGNAL_CARDS = [
  { label: 'Race build', value: 'Periodized' },
  { label: 'Recovery', value: 'Balanced' },
  { label: 'Session logic', value: 'Checked' },
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
  const headline = title ?? (isStrava ? 'Reading your training history.' : 'Building your training calendar.');
  const bodyCopy =
    subtitle ??
    (isStrava
      ? 'TrainGPT is finding the good stuff in your Strava history — big days, fast runs, and useful starting targets.'
      : 'TrainGPT is assembling a realistic race build, checking progression, recovery, session placement, and calendar readiness.');

  const visibleSteps = steps.map((step, index) => ({ step, index })).filter(({ index }) => {
    if (typeof window === 'undefined') return true;
    if (window.innerWidth >= 640) return true;
    return index >= Math.max(0, activeStep - 1) && index <= Math.min(steps.length - 1, activeStep + 1);
  });

  return (
    <div
      data-training-processing-overlay="true"
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-[#f4f1ea]/95 px-3 py-3 backdrop-blur-2xl sm:px-4 sm:py-6"
    >
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute left-1/2 top-[-18rem] h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-white blur-3xl" />
        <div className="absolute bottom-[-20rem] left-[-10rem] h-[34rem] w-[34rem] rounded-full bg-amber-200/50 blur-3xl" />
        <div className="absolute right-[-12rem] top-[20%] h-[30rem] w-[30rem] rounded-full bg-zinc-900/10 blur-3xl" />
      </div>

      <div className="relative my-auto w-full max-w-5xl overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/85 shadow-[0_24px_80px_rgba(24,24,27,0.20)] ring-1 ring-zinc-950/5 backdrop-blur-xl sm:rounded-[2.5rem]">
        <div className="grid max-h-[calc(100dvh-1.5rem)] overflow-y-auto lg:max-h-none lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative min-h-[470px] overflow-hidden bg-zinc-950 p-5 text-white sm:min-h-[560px] sm:p-8 lg:p-10">
            <div className="absolute inset-0 opacity-50">
              <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
              <div className="absolute left-1/2 top-0 h-full w-px bg-gradient-to-b from-transparent via-white/20 to-transparent" />
              <div className="absolute -left-16 top-16 h-56 w-56 rounded-full border border-white/10" />
              <div className="absolute right-8 top-20 h-28 w-28 rounded-full border border-white/10" />
              <div className="absolute bottom-12 right-16 h-40 w-40 rounded-full border border-white/10" />
            </div>

            <div className="relative flex h-full min-h-[430px] flex-col justify-between sm:min-h-[500px]">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60 sm:text-[11px] sm:tracking-[0.18em]">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-40" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                  </span>
                  {isStrava ? 'Training history import' : 'Training engine running'}
                </div>

                <h2 className="mt-5 max-w-xl text-3xl font-semibold leading-[0.95] tracking-[-0.055em] text-white sm:mt-6 sm:text-5xl">
                  {headline}
                </h2>
                <p className="mt-3 max-w-lg text-[13px] leading-5 text-white/60 sm:mt-4 sm:text-sm sm:leading-6">{bodyCopy}</p>
              </div>

              <div className="mt-6 sm:mt-10">
                <div className="relative mx-auto aspect-square max-w-[290px] rounded-full border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/30 sm:max-w-[340px] sm:p-6">
                  <div className="absolute inset-6 rounded-full border border-dashed border-white/15" />
                  <div className="absolute inset-14 rounded-full border border-white/10" />
                  <div className="absolute left-1/2 top-1/2 h-[78%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
                  <div
                    className="absolute left-1/2 top-1/2 h-[86%] w-[86%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-transparent border-t-white/70 border-r-white/15"
                    style={{ animation: 'spin 3.2s linear infinite' }}
                  />
                  <div
                    className="absolute left-1/2 top-1/2 h-[58%] w-[58%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-transparent border-b-amber-200/80 border-l-white/20"
                    style={{ animation: 'spin 4.8s linear infinite reverse' }}
                  />
                  <div className="absolute left-1/2 top-1/2 grid h-28 w-28 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-center text-zinc-950 shadow-[0_20px_60px_rgba(0,0,0,0.35)] sm:h-36 sm:w-36">
                    <div>
                      <div className="text-3xl font-semibold tracking-[-0.06em] sm:text-4xl">{Math.round(progress)}%</div>
                      <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-400 sm:text-[10px]">
                        {isStrava ? 'Synced' : 'Built'}
                      </div>
                    </div>
                  </div>

                  {isStrava ? (
                    <ActivitySignalCards />
                  ) : (
                    PLAN_SIGNAL_CARDS.map((card, index) => {
                      const positions = [
                        'left-2 top-12',
                        'right-0 top-1/2 -translate-y-1/2',
                        'bottom-8 left-8',
                      ];

                      return (
                        <div
                          key={card.label}
                          className={`absolute ${positions[index]} rounded-2xl border border-white/10 bg-white/10 px-3 py-2 backdrop-blur`}
                        >
                          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">{card.label}</div>
                          <div className="mt-0.5 text-xs font-semibold text-white">{card.value}</div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-8 lg:p-10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400 sm:text-xs sm:tracking-[0.22em]">
                  {isStrava ? 'Training history' : 'Plan assembly'}
                </p>
                <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-zinc-950 sm:mt-3 sm:text-2xl">
                  {isStrava ? 'Finding the best stuff in your year.' : 'Turning inputs into a usable week-by-week plan.'}
                </h3>
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

            <div className="mt-5 rounded-[1.25rem] border border-zinc-200 bg-[#fbfaf8] p-3 sm:mt-8 sm:rounded-[1.5rem] sm:p-4">
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

            <div className="mt-4 space-y-2 sm:mt-5 sm:space-y-3">
              {visibleSteps.map(({ step, index }) => {
                const active = index === activeStep;
                const complete = index < activeStep;

                return (
                  <div
                    key={step}
                    className={`group relative overflow-hidden rounded-2xl border px-3 py-2.5 text-[13px] transition sm:px-4 sm:py-3 sm:text-sm ${
                      active
                        ? 'border-zinc-300 bg-white text-zinc-950 shadow-sm'
                        : complete
                          ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
                          : 'border-zinc-200 bg-white/70 text-zinc-400'
                    }`}
                  >
                    {active ? <div className="absolute inset-y-0 left-0 w-1 bg-zinc-950" /> : null}
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold sm:h-7 sm:w-7 sm:text-[11px] ${
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
                  </div>
                );
              })}
            </div>

            <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-3 text-xs leading-5 text-zinc-500 sm:mt-6 sm:p-4">
              {isStrava
                ? 'TrainGPT is pulling up your biggest, fastest, most useful training moments while the import finishes.'
                : 'Longer race plans can take a minute. Keep this tab open while TrainGPT completes the final quality checks.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
