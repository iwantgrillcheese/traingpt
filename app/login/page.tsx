'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';

function resolveSafeNext(raw: string | null) {
  if (!raw) return '/plan';
  if (!raw.startsWith('/')) return '/plan';
  if (raw.startsWith('//')) return '/plan';

  return raw;
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const next = useMemo(
    () => resolveSafeNext(searchParams?.get('next') ?? null),
    [searchParams]
  );

  const error = searchParams?.get('error') ?? null;

  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      const result = await supabase.auth.getSession();

      if (cancelled) return;

      if (result.data.session) {
        router.replace(next);
        return;
      }

      setIsCheckingSession(false);
    };

    checkSession();

    return () => {
      cancelled = true;
    };
  }, [router, next]);

  const signInWithGoogle = async () => {
    try {
      setIsSigningIn(true);

      const origin = window.location.origin;
      const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (signInError) {
        console.error('[login] Google sign-in failed:', signInError);
        setIsSigningIn(false);
      }
    } catch (err) {
      console.error('[login] unexpected sign-in error:', err);
      setIsSigningIn(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
          TrainGPT
        </p>

        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
          Start training smarter
        </h1>

        <p className="mt-4 text-sm leading-6 text-zinc-600">
          Sign in with Google to generate your personalized training plan, view your schedule,
          and connect Strava.
        </p>

        {error ? (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-left text-sm text-rose-700">
            {error === 'oauth_exchange_failed'
              ? 'Google sign-in could not be completed. Please try again from this page.'
              : 'Sign-in could not be completed. Please try again.'}
          </div>
        ) : null}

        <button
          type="button"
          onClick={signInWithGoogle}
          disabled={isCheckingSession || isSigningIn}
          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-zinc-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isCheckingSession
            ? 'Checking session…'
            : isSigningIn
              ? 'Opening Google…'
              : 'Continue with Google'}
        </button>
      </div>
    </main>
  );
}

function LoginFallback() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">
          TrainGPT
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
          Loading sign in…
        </h1>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  );
}