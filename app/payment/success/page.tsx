'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type ConfirmationState = 'confirming' | 'ready' | 'error';

export const dynamic = 'force-dynamic';

function PaymentSuccessFallback() {
  return (
    <main className="min-h-screen bg-[#f6f3ee] px-4 py-8 text-zinc-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
          <p className="text-sm font-medium text-zinc-500">Loading your subscription confirmation…</p>
        </div>
      </div>
    </main>
  );
}

function PaymentSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams?.get('session_id');
  const planId = searchParams?.get('planId');

  const [state, setState] = useState<ConfirmationState>('confirming');
  const [error, setError] = useState<string | null>(null);
  const [scheduleUrl, setScheduleUrl] = useState('/schedule?upgraded=true');

  const benefits = useMemo(
    () => [
      {
        title: 'Your full calendar is unlocked',
        copy: 'Open the complete schedule with every swim, bike, run, strength, recovery day, and race-specific progression.',
      },
      {
        title: 'Generate detailed workouts',
        copy: 'Turn planned sessions into practical warmups, main sets, and cooldowns when you need more structure.',
      },
      {
        title: 'Use Strava as your training record',
        copy: 'Connect completed workouts to the schedule so your plan becomes easier to follow and review.',
      },
      {
        title: 'Regenerate when life changes',
        copy: 'Adjust the plan when your schedule, race, or availability changes instead of forcing a static PDF.',
      },
    ],
    []
  );

  useEffect(() => {
    let cancelled = false;

    async function confirmSession() {
      if (!sessionId) {
        setState('error');
        setError('Missing Stripe checkout session. Please contact support if your subscription was charged.');
        return;
      }

      try {
        setState('confirming');
        setError(null);

        const res = await fetch('/api/stripe/confirm-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, planId }),
        });

        const json = await res.json().catch(() => null);

        if (!res.ok || !json?.ok) {
          throw new Error(json?.error ?? 'We could not confirm your subscription yet.');
        }

        if (cancelled) return;
        setScheduleUrl(json.scheduleUrl ?? '/schedule?upgraded=true');
        setState('ready');
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'We could not confirm your subscription yet.';
        setError(message);
        setState('error');
      }
    }

    confirmSession();

    return () => {
      cancelled = true;
    };
  }, [planId, sessionId]);

  const continueToSchedule = useCallback(() => {
    router.replace(scheduleUrl);
  }, [router, scheduleUrl]);

  return (
    <main className="min-h-screen bg-[#f6f3ee] px-4 py-8 text-zinc-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center">
        <section className="w-full overflow-hidden rounded-[2.25rem] border border-zinc-200 bg-white shadow-sm">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
            <div className="p-7 sm:p-10 lg:p-12">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                TrainGPT Plus active
              </div>

              <h1 className="mt-6 max-w-2xl text-4xl font-semibold tracking-[-0.045em] text-zinc-950 sm:text-6xl">
                You’re in. Your full plan is unlocked.
              </h1>

              <p className="mt-5 max-w-xl text-base leading-7 text-zinc-500">
                Your subscription is confirmed. Here’s what you now have access to before you jump into the schedule.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {benefits.map((benefit, index) => (
                  <div key={benefit.title} className="rounded-3xl border border-zinc-200 bg-[#faf9f6] p-5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-950 text-sm font-semibold text-white">
                      {index + 1}
                    </div>
                    <h2 className="mt-4 text-sm font-semibold text-zinc-950">{benefit.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-zinc-500">{benefit.copy}</p>
                  </div>
                ))}
              </div>
            </div>

            <aside className="bg-zinc-950 p-7 text-white sm:p-10 lg:p-12">
              <div className="flex h-full flex-col justify-between rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/20">
                <div>
                  <p className="text-sm font-medium text-white/55">Next step</p>
                  <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">
                    Start with your schedule.
                  </h2>
                  <p className="mt-4 text-sm leading-6 text-white/60">
                    Your first priority is simple: review the first week, understand where the key sessions land, then start training.
                  </p>

                  {state === 'confirming' ? (
                    <div className="mt-7 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="flex items-center gap-3 text-sm text-white/70">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                        Confirming subscription…
                      </div>
                    </div>
                  ) : null}

                  {state === 'error' ? (
                    <div className="mt-7 rounded-3xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
                      {error}
                      <div className="mt-3 text-white/60">
                        If Stripe charged successfully, wait a few seconds and try again. The webhook can occasionally lag.
                      </div>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={continueToSchedule}
                    disabled={state === 'confirming'}
                    className="mt-7 w-full rounded-full bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {state === 'confirming' ? 'Unlocking…' : 'Go to my schedule'}
                  </button>

                  {state === 'error' ? (
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="mt-3 w-full rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                      Try confirming again
                    </button>
                  ) : null}
                </div>

                <div className="mt-8 border-t border-white/10 pt-6 text-xs leading-5 text-white/40">
                  Billing is handled securely by Stripe. You can manage or cancel your subscription from Settings.
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<PaymentSuccessFallback />}>
      <PaymentSuccessContent />
    </Suspense>
  );
}
