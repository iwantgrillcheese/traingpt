'use client';

import { useState } from 'react';
import Link from 'next/link';
import ProfileAvatar from './profile avatar';
import clsx from 'clsx';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="relative min-h-screen font-sans text-gray-900 bg-white">
      {/* Top Nav */}
      <nav className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 shadow-sm">
        {/* Left Section: Brand + Toggle */}
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xl font-bold tracking-tight">
            TrainGPT
          </Link>

          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle sidebar"
            className={clsx(
              'relative w-10 h-5 rounded-full transition-colors duration-300 ease-in-out',
              sidebarOpen ? 'bg-indigo-500' : 'bg-gray-300'
            )}
          >
            <span
              className={clsx(
                'absolute top-[2px] left-[2px] h-4 w-4 rounded-full bg-white shadow transition-transform duration-300 ease-in-out',
                sidebarOpen ? 'translate-x-5' : 'translate-x-0'
              )}
            />
          </button>
        </div>

        {/* Right Section: Profile */}
        <div className="ml-auto">
          <ProfileAvatar />
        </div>
      </nav>

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed top-0 left-0 z-20 h-full bg-white border-r border-gray-100 transition-all duration-300 ease-in-out',
          sidebarOpen ? 'w-48 px-6 pt-20' : 'w-0 px-0'
        )}
      >
        <nav className="flex flex-col gap-6 text-sm h-full overflow-hidden transition-opacity duration-300">
          <Link href="/" className="block hover:font-medium">
            Plan Generator
          </Link>
          <Link href="/schedule" className="block hover:font-medium">
            My Schedule
          </Link>
          <Link href="/coaching" className="block hover:font-medium">
            Coaching
          </Link>
          <Link href="/settings" className="block hover:font-medium">
            Settings
          </Link>
        </nav>
      </aside>

      {/* Main content */}
      <main className="pt-24 px-4 max-w-7xl mx-auto transition-all duration-300">
        {children}
      </main>
    </div>
  );
}
