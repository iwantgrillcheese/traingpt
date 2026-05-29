'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import ProfileAvatar from './profile avatar';

type NavItem = {
  label: string;
  href: string;
};

const NAV: NavItem[] = [
  { label: 'Schedule', href: '/schedule' },
  { label: 'Coaching', href: '/coaching' },
  { label: 'Plan', href: '/plan' },
  { label: 'Settings', href: '/settings' },
];

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function AppSidebar({ pathname }: { pathname: string | null }) {
  return (
    <aside className="hidden border-r border-zinc-200 bg-[#fbfbfa] lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-[244px] lg:flex-col">
      <div className="px-5 pb-4 pt-6">
        <Link href="/schedule" className="block">
          <div className="text-[17px] font-semibold tracking-tight text-zinc-950">TrainGPT</div>
          <div className="mt-1 text-xs text-zinc-500">Triathlon training</div>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col px-3 pb-4 text-sm">
        <div className="space-y-1 border-t border-zinc-200 pt-4">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'flex items-center rounded-lg px-3 py-2.5 text-[14px] font-medium transition',
                  active
                    ? 'bg-zinc-950 text-white'
                    : 'text-zinc-600 hover:bg-white hover:text-zinc-950'
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
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur lg:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/schedule" className="text-sm font-semibold tracking-tight text-zinc-950">
          TrainGPT
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/schedule"
            className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700"
          >
            Schedule
          </Link>
          <ProfileAvatar variant="compact" />
        </div>
      </div>
    </header>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isLanding = pathname === '/';
  const isSchedule = useMemo(
    () => pathname === '/schedule' || pathname?.startsWith('/schedule/'),
    [pathname]
  );

  if (isLanding) {
    return <div className="min-h-[100dvh] bg-white text-zinc-950">{children}</div>;
  }

  // Schedule currently owns custom calendar chrome. Keep it full-bleed until
  // we consolidate the app shell across every product surface.
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
