'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import ProfileAvatar from './profile avatar';
import Footer from './footer';
import type { Session } from '@supabase/auth-helpers-nextjs';

const supabase = createClientComponentClient();

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hasPlan, setHasPlan] = useState(false);

  useEffect(() => {
    const checkPlan = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (session?.user) {
        const { data: planData } = await supabase
          .from('plans')
          .select('id')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        setHasPlan(!!planData?.id);
      }
    };

    checkPlan();
  }, []);

  return (
    <div className="relative min-h-screen font-sans text-gray-900 bg-white">
      {/* Top Nav */}
      <nav className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-4 bg-white border-b border-white sm:justify-start">
        <Link href="/" className="text-lg font-semibold mr-3">TrainGPT</Link>

        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="relative w-6 h-4 rounded-full border border-gray-300 hover:border-gray-400 transition-all bg-white flex items-center justify-center"
        >
          <span className="sr-only">Toggle Sidebar</span>
          <div
            className={`absolute w-0.5 h-2 bg-gray-700 transition-transform duration-300 ${
              sidebarOpen ? 'translate-x-1.5' : '-translate-x-1.5'
            }`}
          />
        </button>

        <div className="ml-auto">
          <ProfileAvatar />
        </div>
      </nav>

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-20 h-full bg-white transition-all duration-300 ease-in-out 
          ${sidebarOpen ? 'w-48 px-6 pt-20' : 'w-0 px-0'} 
          overflow-hidden`}
      >
        <nav className="flex flex-col justify-center gap-6 text-sm h-full">
          {!hasPlan && (
            <Link href="/" className="block hover:font-medium">Plan Generator</Link>
          )}
          <Link href="/schedule" className="block hover:font-medium">My Schedule</Link>
          <Link href="/coaching" className="block hover:font-medium">Coaching</Link>
          <Link href="/settings" className="block hover:font-medium">Settings</Link>
        </nav>
      </aside>

      {/* Main content */}
      <main className="pt-24 px-4 max-w-7xl mx-auto transition-all duration-300">
        {children}
      </main>

<Footer /> 

    </div>
  );
}
