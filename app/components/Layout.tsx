'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import ProfileAvatar from './profile avatar';

const APP_ROUTES = ['/schedule', '/coaching', '/plan', '/settings'];

const DESKTOP_NAV_ITEMS = [
  { label: 'Schedule', href: '/schedule' },
  { label: 'Coaching', href: '/coaching' },
  { label: 'Plan', href: '/plan' },
  { label: 'Settings', href: '/settings' },
];

const MOBILE_PRIMARY_NAV_ITEMS = [
  { label: 'Schedule', href: '/schedule' },
  { label: 'Coach', href: '/coaching' },
  { label: 'Plan', href: '/plan' },
];

function isAppRoute(pathname: string | null) {
  if (!pathname) return false;
  return APP_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function AppSidebar({ pathname }: { pathname: string | null }) {
  return (
    <aside className="hidden border-r border-zinc-200 bg-white lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-[232px] lg:flex-col">
      <div className="px-5 pb-5 pt-7">
        <Link href="/schedule" className="block">
          <div className="text-[17px] font-semibold tracking-tight text-zinc-950">TrainGPT</div>
          <div className="mt-1 text-xs text-zinc-500">Triathlon training</div>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col px-3 pb-4 text-sm">
        <div className="space-y-1 border-t border-zinc-200 pt-4">
          {DESKTOP_NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'flex items-center rounded-lg px-3 py-2.5 text-[14px] font-medium transition-colors',
                  active
                    ? 'bg-zinc-950 text-white'
                    : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950'
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="mt-auto border-t border-zinc-200 pt-4">
          <ProfileAvatar variant="sidebar" />
        </div>
      </nav>
    </aside>
  );
}

function MobileHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur lg:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/schedule" className="text-sm font-semibold tracking-tight text-zinc-950">
          TrainGPT
        </Link>

        <ProfileAvatar variant="compact" />
      </div>
    </header>
  );
}

function MobileBottomNav({ pathname }: { pathname: string | null }) {
  const [moreOpen, setMoreOpen] = useState(false);

  const settingsActive = isActive(pathname, '/settings');

  return (
    <>
      {moreOpen ? (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px] lg:hidden"
          onClick={() => setMoreOpen(false)}
        />
      ) : null}

      {moreOpen ? (
        <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-50 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-[0_24px_80px_rgba(24,24,27,0.18)] lg:hidden">
          <div className="border-b border-zinc-100 px-4 py-3">
            <div className="text-sm font-semibold text-zinc-950">More</div>
            <div className="mt-0.5 text-xs text-zinc-500">Account and product settings</div>
          </div>

          <div className="p-2">
            <Link
              href="/settings"
              onClick={() => setMoreOpen(false)}
              className={clsx(
                'flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium transition-colors',
                settingsActive
                  ? 'bg-zinc-950 text-white'
                  : 'text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950'
              )}
            >
              <span>Settings</span>
              <span className={settingsActive ? 'text-white/60' : 'text-zinc-400'}>›</span>
            </Link>

            <div className="mt-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-2">
              <ProfileAvatar variant="sidebar" />
            </div>
          </div>
        </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+6px)] pt-2 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
          {MOBILE_PRIMARY_NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'flex h-11 items-center justify-center rounded-2xl text-[12px] font-semibold transition-colors',
                  active
                    ? 'bg-zinc-950 text-white'
                    : 'text-zinc-500 active:bg-zinc-100 active:text-zinc-950'
                )}
              >
                {item.label}
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            className={clsx(
              'flex h-11 items-center justify-center rounded-2xl text-[12px] font-semibold transition-colors',
              moreOpen || settingsActive
                ? 'bg-zinc-950 text-white'
                : 'text-zinc-500 active:bg-zinc-100 active:text-zinc-950'
            )}
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
          >
            More
          </button>
        </div>
      </nav>
    </>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (!isAppRoute(pathname)) {
    return <div className="min-h-[100dvh] bg-white text-zinc-950">{children}</div>;
  }

  const isSchedule = pathname === '/schedule' || pathname?.startsWith('/schedule/');

  return (
    <div className="min-h-[100dvh] bg-[#fbfbfa] text-zinc-950">
      <AppSidebar pathname={pathname} />
      <MobileHeader />

      <main className="min-h-[100dvh] pb-24 lg:pb-0 lg:pl-[232px]">
        {isSchedule ? (
          children
        ) : (
          <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
            {children}
          </div>
        )}
      </main>

      <MobileBottomNav pathname={pathname} />
    </div>
  );
}
