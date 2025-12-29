'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import ProfileAvatar from './profile avatar';

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close drawer on route change / resize to desktop, etc. (basic safety)
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setSidebarOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="min-h-[100dvh] bg-white text-gray-900">
      {/* Header: sticky (not fixed) so the page scroll behaves normally on iOS */}
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xl font-bold tracking-tight">
              TrainGPT
            </Link>

            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label="Toggle sidebar"
              className={clsx(
                'relative h-6 w-11 rounded-full transition-colors duration-200',
                sidebarOpen ? 'bg-black' : 'bg-gray-200'
              )}
            >
              <span
                className={clsx(
                  'absolute top-[3px] left-[3px] h-4 w-4 rounded-full bg-white shadow transition-transform duration-200',
                  sidebarOpen ? 'translate-x-5' : 'translate-x-0'
                )}
              />
            </button>

            {/* Optional: a “Walkthrough” button could live here later */}
          </div>

          <ProfileAvatar />
        </div>
      </header>

      {/* Drawer backdrop */}
      <div
        className={clsx(
          'fixed inset-0 z-30 bg-black/20 transition-opacity',
          sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Drawer */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 w-72 bg-white shadow-xl transition-transform duration-200',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{
          // iOS safe area support
          paddingTop: 'calc(env(safe-area-inset-top) + 12px)',
        }}
      >
        <nav className="flex h-full flex-col gap-2 px-5 pb-6 pt-2 text-sm">
          <Link
            href="/"
            onClick={() => setSidebarOpen(false)}
            className="rounded-xl px-3 py-2 hover:bg-gray-50"
          >
            Plan Generator
          </Link>
          <Link
            href="/schedule"
            onClick={() => setSidebarOpen(false)}
            className="rounded-xl px-3 py-2 hover:bg-gray-50"
          >
            My Schedule
          </Link>
          <Link
            href="/coaching"
            onClick={() => setSidebarOpen(false)}
            className="rounded-xl px-3 py-2 hover:bg-gray-50"
          >
            Coaching
          </Link>
          <Link
            href="/settings"
            onClick={() => setSidebarOpen(false)}
            className="rounded-xl px-3 py-2 hover:bg-gray-50"
          >
            Settings
          </Link>

          <div className="mt-auto pt-4 text-xs text-gray-400">
            Built for real training.
          </div>
        </nav>
      </aside>

      {/* Main content: normal document flow scroll */}
      <main className="mx-auto max-w-7xl px-4 py-6">
        {children}
      </main>
    </div>
  );
}
