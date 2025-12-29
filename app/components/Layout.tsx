'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import clsx from 'clsx';
import ProfileAvatar from './profile avatar';

type NavItem = {
  label: string;
  href: string;
};

const NAV: NavItem[] = [
  { label: 'Plan Generator', href: '/' },
  { label: 'My Schedule', href: '/schedule' },
  { label: 'Coaching', href: '/coaching' },
  { label: 'Settings', href: '/settings' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Close drawer on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Close drawer on resize to desktop
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setSidebarOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const navigate = useCallback(
    (href: string) => {
      // Close immediately for UI responsiveness
      setSidebarOpen(false);
      // Force navigation via router (bypasses any Link propagation weirdness)
      router.push(href);
    },
    [router]
  );

  const navItemClass = (href: string) =>
    clsx(
      'block w-full rounded-xl px-3 py-2 text-left transition',
      pathname === href ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-50'
    );

  return (
    <div className="min-h-[100dvh] bg-white text-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xl font-bold tracking-tight">
              TrainGPT
            </Link>

            {/* Toggle */}
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
          </div>

          <ProfileAvatar />
        </div>
      </header>

      {/* Backdrop */}
      <div
        className={clsx(
          'fixed inset-0 z-30 bg-black/30 transition-opacity',
          sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 bg-white shadow-xl transition-transform duration-200 will-change-transform pointer-events-auto',
          'w-[82vw] max-w-[320px]',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="px-5 pt-4 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-900">Menu</div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              aria-label="Close menu"
            >
              Close
            </button>
          </div>
          <div className="mt-1 text-xs text-gray-500">Navigate your training</div>
        </div>

        <nav className="flex h-full flex-col px-3 py-3 text-sm overflow-y-auto">
          <div className="flex flex-col gap-1 pt-1">
            {NAV.map((item) => (
              <button
                key={item.href}
                type="button"
                className={navItemClass(item.href)}
                onClick={() => navigate(item.href)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-auto px-2 pt-6 text-xs text-gray-400">
            Built for real training.
          </div>
        </nav>
      </aside>

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
