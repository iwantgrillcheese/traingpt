'use client';

import { useEffect } from 'react';

type ScheduleErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ScheduleError({ error, reset }: ScheduleErrorProps) {
  useEffect(() => {
    console.error('[schedule/error]', error);
  }, [error]);

  return (
    <main className="min-h-[100dvh] bg-zinc-50 px-4 py-10">
      <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center">
        <section className="w-full rounded-3xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
            Schedule
          </p>

          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-950">
            Your calendar could not load.
          </h1>

          <p className="mt-3 text-sm leading-6 text-zinc-600">
            We could not render your schedule just now. This is usually a temporary data or sync
            issue. Try again, or return to coaching while we recover the calendar.
          </p>

          {error.digest ? (
            <p className="mt-3 rounded-2xl bg-zinc-50 px-3 py-2 text-xs text-zinc-400">
              Error reference: {error.digest}
            </p>
          ) : null}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex items-center justify-center rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Reload schedule
            </button>

            <a
              href="/coaching"
              className="inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
            >
              Open coaching
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
