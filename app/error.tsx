'use client';

import { useEffect } from 'react';

type AppErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AppError({ error, reset }: AppErrorProps) {
  useEffect(() => {
    console.error('[app/error]', error);
  }, [error]);

  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-white px-6 py-16">
      <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
          TrainGPT
        </p>

        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-zinc-950">
          Something went wrong.
        </h1>

        <p className="mt-3 text-sm leading-6 text-zinc-600">
          The app hit an unexpected error. Your training data should be safe. Try again, or reload
          the page if the issue continues.
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
            Try again
          </button>

          <a
            href="/schedule"
            className="inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
          >
            Go to schedule
          </a>
        </div>
      </div>
    </main>
  );
}
