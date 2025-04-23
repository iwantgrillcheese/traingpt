'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Footer from './components/footer';
import BlogPreview from './components/blog/BlogPreview';
import { createClient, type Session } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Home() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [userNote, setUserNote] = useState('');

  useEffect(() => {
    const checkSessionAndPlan = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);

      if (session?.user) {
        const { data: plans, error } = await supabase
          .from('plans')
          .select('id')
          .eq('user_id', session.user.id)
          .limit(1);

        if (!error && plans && plans.length > 0) {
          router.push('/schedule');
        }
      }
    };

    checkSessionAndPlan();
  }, [router]);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-semibold tracking-tight">
            Smarter Endurance Plans. Instantly.
          </h1>
          <p className="mt-3 text-gray-500 text-lg">
            Generate your personalized triathlon training plan in seconds.
          </p>
        </div>

        <form className="bg-gray-50 border border-gray-200 shadow-sm rounded-xl p-8 grid gap-6 mb-6">
          <div>
            <label htmlFor="userNote" className="block text-sm font-medium text-gray-700 mb-1">
              Customize your plan (optional)
            </label>
            <textarea
              id="userNote"
              rows={3}
              value={userNote}
              onChange={e => setUserNote(e.target.value)}
              placeholder="E.g. I’m targeting a 1:30 half marathon off the bike and need help with swim fitness..."
              className="w-full bg-white border border-gray-300 rounded-md p-2 text-sm"
            />
          </div>

          <div className="text-center mt-4">
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="bg-black text-white px-8 py-3 rounded-full font-medium hover:bg-gray-800"
            >
              Sign in to Generate Your Plan
            </button>
          </div>
        </form>
      </main>

      <div className="max-w-screen-xl mx-auto px-6">
        <BlogPreview />
      </div>

      <Footer />
    </div>
  );
}
