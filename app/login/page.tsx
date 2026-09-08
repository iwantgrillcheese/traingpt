'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase-client';

function resolveSafeNext(raw: string | null) {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/plan';
  return raw;
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = useMemo(() => resolveSafeNext(searchParams?.get('next') ?? null), [searchParams]);
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
    void checkSession();
    return () => { cancelled = true; };
  }, [router, next]);

  const signInWithGoogle = async () => {
    try {
      setIsSigningIn(true);
      const origin = window.location.origin;
      const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, queryParams: { access_type: 'offline', prompt: 'consent' } },
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
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#FBFBFA] px-4">
      <div className="w-full max-w-sm rounded-[2rem] border border-[#E3E0D8] bg-white p-7 text-center shadow-[0_24px_80px_rgba(16,17,20,0.08)]">
        <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Brick</p>
        <h1 className="text-3xl font-black tracking-[-0.05em] text-zinc-950">Save your training plan</h1>
        <p className="mt-4 text-sm leading-6 text-zinc-600">An account lets Brick keep your race build, training zones, Strava matches, plan history, and weekly adjustments in one place.</p>

        {error ? <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-left text-sm text-rose-700">{error === 'oauth_exchange_failed' ? 'Google sign-in could not be completed. Please try again from this page.' : 'Sign-in could not be completed. Please try again.'}</div> : null}

        <button type="button" onClick={signInWithGoogle} disabled={isCheckingSession || isSigningIn} className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-zinc-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60">
          {isCheckingSession ? 'Checking session…' : isSigningIn ? 'Opening Google…' : 'Continue with Google'}
        </button>
        <a href="/preview" className="mt-4 inline-flex text-xs font-bold text-[#6B7280] underline underline-offset-4">Back to plan preview</a>
      </div>
    </main>
  );
}

function LoginFallback() {
  return <main className="flex min-h-screen items-center justify-center bg-[#FBFBFA] px-4"><p className="text-sm font-black text-[#6B7280]">Brick · Loading sign in…</p></main>;
}

export default function LoginPage() {
  return <Suspense fallback={<LoginFallback />}><LoginContent /></Suspense>;
}
