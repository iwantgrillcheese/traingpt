'use client';

import { useState } from 'react';
import Link from 'next/link';
import ProfileAvatar from './profile avatar';
import clsx from 'clsx';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-[100dvh] bg-white text-gray-900 font-sans">
      {/* Top Nav (fixed) */}
      <nav className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xl font-bold tracking-tight">
            TrainGPT
          </Link>

          <button
            onClick={() => setSidebarOpen((v) => !v)}
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

        <div className="ml-auto">
          <ProfileAvatar />
        </div>
      </nav>

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed top-0 left-0 z-30 h-[100dvh] bg-white border-r border-gray-100 transition-[width,padding] duration-300 ease-in-out overflow-hidden',
          sidebarOpen ? 'w-48 px-6 pt-20' : 'w-0 px-0 pt-20'
        )}
        aria-hidden={!sidebarOpen}
      >
        <nav className="flex flex-col gap-6 text-sm">
          <Link href="/" className="block hover:font-medium" onClick={() => setSidebarOpen(false)}>
            Plan Generator
          </Link>
          <Link href="/schedule" className="block hover:font-medium" onClick={() => setSidebarOpen(false)}>
            My Schedule
          </Link>
          <Link href="/coaching" className="block hover:font-medium" onClick={() => setSidebarOpen(false)}>
            Coaching
          </Link>
          <Link href="/settings" className="block hover:font-medium" onClick={() => setSidebarOpen(false)}>
            Settings
          </Link>
        </nav>
      </aside>

      {/* Main scroll area (THIS is the only scroller) */}
      <div className="pt-16">
        <main className="h-[calc(100dvh-64px)] overflow-y-auto overscroll-contain px-4">
          <div className="max-w-7xl mx-auto py-8">{children}</div>
        </main>
      </div>

      {/* Optional: click-away overlay when sidebar is open */}
      {sidebarOpen && (
        <button
          aria-label="Close sidebar"
          className="fixed inset-0 z-20 bg-black/10"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
