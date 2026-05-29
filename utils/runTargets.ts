'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import ProfileAvatar from './profile avatar';

type NavItem = {
  label: string;
  href: string;
  caption?: string;
};

const NAV: NavItem[] = [
  { label: 'Schedule', href: '/schedule', caption: 'Calendar' },
  { label: 'Plan', href: '/plan', caption: 'Generator' },
  { label: 'Coaching', href: '/coaching', caption: 'Brief' },
  { label: 'Settings', href: '/settings', caption: 'Account' },
];

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function AppSidebar({ pathname }: { pathname: string | null }) {
  return (
    <aside className="hidden border-r border-zinc-200 bg-[#fbfbfa] lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-[244px] lg:flex-col">
      <div className="border-b border-zinc-200 px-5 py-5">
        <Link href="/schedule" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-950 text-sm font-semibold text-white shadow-sm">
            T
          </div>
          <div>
            <div className="text-[15px] font-semibold tracking-tight text-zinc-950">TrainGPT</div>
            <div className="mt-0.5 text-xs text-zinc-500">Plans · Calendar · Strava</div>
          </div>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col px-3 py-4 text-sm">
        <div className="space-y-1">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'group flex items-center justify-between rounded-xl px-3 py-2.5 transition',
                  active
                    ? 'bg-zinc-950 text-white shadow-sm'
                    : 'text-zinc-600 hover:bg-white hover:text-zinc-950'
                )}
              >
                <span className="font-medium">{item.label}</span>
                {item.caption ? (
                  <span className={clsx('text-[11px]', active ? 'text-zinc-300' : 'text-zinc-400')}>
                    {item.caption}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>

        <div className="mt-auto space-y-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
              Training OS
            </div>
            <p className="mt-2 text-sm leading-5 text-zinc-700">
              Keep the week simple. Execute the next session well.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-3">
            <div className="flex items-center gap-3">
              <ProfileAvatar />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-zinc-950">Account</div>
                <div className="text-xs text-zinc-500">Settings & sync</div>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </aside>
  );
}

function MobileHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur lg:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/schedule" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-950 text-xs font-semibold text-white">
            T
          </div>
          <span className="text-sm font-semibold tracking-tight text-zinc-950">TrainGPT</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/schedule"
            className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700"
          >
            Schedule
          </Link>
          <ProfileAvatar />
        </div>
      </div>
    </header>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isLanding = pathname === '/';
  const isSchedule = useMemo(() => pathname === '/schedule' || pathname?.startsWith('/schedule/'), [pathname]);

  if (isLanding) {
    return <div className="min-h-[100dvh] bg-white text-zinc-950">{children}</div>;
  }

  // Schedule currently owns a custom calendar shell/sidebar. Keep it full-bleed until
  // we consolidate app chrome across all pages in a later pass.
  if (isSchedule) {
    return <div className="min-h-[100dvh] bg-[#fbfbfa] text-zinc-950">{children}</div>;
  }

  return (
    <div className="min-h-[100dvh] bg-[#fbfbfa] text-zinc-950">
      <AppSidebar pathname={pathname} />
      <MobileHeader />

      <main className="lg:pl-[244px]">
        <div className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
