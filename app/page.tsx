'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Footer from './components/footer';
import BlogPreview from './components/blog/BlogPreview';
import { createClient, type Session } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const quotes = [
  "Don't count the days, make the days count.",
  "Discipline is doing it when you don’t feel like it.",
  "Train hard, race easy.",
  "Little by little, a little becomes a lot.",
  "The only bad workout is the one you didn’t do."
];

export default function Home() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });
  }, []);

  const handleCTA = () => {
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* 👇 Form Section: stays narrow */}
      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-semibold tracking-tight">
            Smarter Endurance Plans. Instantly.
          </h1>
          <p className="mt-3 text-gray-500 text-lg">
            Generate your personalized triathlon training plan in seconds.
          </p>
        </div>

        <form className="bg-gray-50 border border-gray-200 shadow-sm rounded-xl p-8 grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {[
            "Race Type",
            "Race Date",
            "Bike FTP",
            "Run Pace",
            "Swim Pace",
            "Experience",
            "Max Hours",
            "Rest Day"
          ].map((label, i) => (
            <div key={i}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {label}
              </label>
              <input
                disabled
                placeholder="..."
                className="w-full bg-white border border-gray-300 rounded-md p-2 text-sm opacity-50 cursor-not-allowed"
              />
            </div>
          ))}
          <div className="md:col-span-2 text-center mt-4">
            <button
              type="button"
              onClick={handleCTA}
              className="bg-black text-white px-8 py-3 rounded-full font-medium hover:bg-gray-800"
            >
              Sign in to Generate Your Plan
            </button>
          </div>
        </form>
      </main>

      {/* 👇 Blog Section: wider like OpenAI's */}
      <div className="max-w-screen-xl mx-auto px-6">
        <BlogPreview />
      </div>

      <Footer />
    </div>
  );
}
