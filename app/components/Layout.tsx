'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import ProfileAvatar from './ProfileAvatar';

const APP_ROUTES = ['/schedule', '/coaching', '/plan', '/settings'];
const SIDEBAR_STORAGE_KEY = 'traingpt.sidebarCollapsed';

const DESKTOP_NAV_ITEMS = [
  { label: 'Schedule', href: '/schedule', shortLabel: 'S' },
  { label: 'Coaching', href: '/coaching', shortLabel: 'C' },
  { label: 'Plan', href: '/plan', shortLabel: 'P' },
  { label: 'Settings', href: '/settings', shortLabel: '⚙' },
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

function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (stored === 'true') setCollapsed(true);
      if (stored === 'false') setCollapsed(false);
    } catch {
      // localStorage can be unavailable in private contexts. Default expanded.
    }
  }, []);

  const updateCollapsed = (next: boolean) => {
    setCollapsed(next);

    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
    } catch {
      // Non-critical preference persistence.
    }
  };

  return { collapsed, setCollapsed: updateCollapsed };
}

function AppSidebar({
  pathname,
  collapsed,
  onToggleCollapsed,
}: {
  pathname: string | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  return (
    <aside
      className={clsx(
        'hidden border-r border-zinc-200 bg-white lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:flex-col lg:transition-[width] lg:duration-200 lg:ease-out',
        collapsed ? 'lg:w-[64px]' : 'lg:w-[232px]'
      )}
    >
      <div
        className={clsx(
          'flex items-center border-b border-zinc-100',
          collapsed ? 'justify-center px-2 py-4' : 'justify-between px-4 py-5'
        )}
      >
        <Link
          href="/schedule"
          className={clsx(
            'min-w-0 font-semibold tracking-tight text-zinc-950',
            collapsed ? 'sr-only' : 'block text-[17px]'
          )}
        >
          TrainGPT
        </Link>

        {collapsed ? null : (
          <Link href="/schedule" className="hidden">
            TrainGPT
          </Link>
        )}

        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={clsx(
            'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-950',
            collapsed && 'mx-auto'
          )}
        >
          <span aria-hidden="true" className="text-[15px] leading-none">
            {collapsed ? '›' : '‹'}
          </span>
        </button>
      </div>

      <nav className={clsx('flex flex-1 flex-col text-sm', collapsed ? 'px-2 py-3' : 'px-3 py-4')}>
        <div className="space-y-1">
          {DESKTOP_NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                aria-label={collapsed ? item.label : undefined}
                className={clsx(
                  'flex items-center rounded-xl font-medium transition-colors',
                  collapsed ? 'h-10 justify-center px-0 text-[13px]' : 'px-3 py-2.5 text-[14px]',
                  active
                    ? 'bg-zinc-100 text-zinc-950'
                    : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950'
                )}
              >
                {collapsed ? (
                  <span className="flex h-6 w-6 items-center justify-center rounded-md text-[12px]">
                    {item.shortLabel}
                  </span>
                ) : (
                  item.label
                )}
              </Link>
            );
          })}
        </div>

        <div className={clsx('mt-auto border-t border-zinc-100 pt-3', collapsed && 'flex justify-center')}>
          <ProfileAvatar variant={collapsed ? 'rail' : 'sidebar'} />
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
  const { collapsed, setCollapsed } = useSidebarCollapsed();

  const shellOffsetClass = useMemo(
    () => (collapsed ? 'lg:pl-[64px]' : 'lg:pl-[232px]'),
    [collapsed]
  );

  if (!isAppRoute(pathname)) {
    return <div className="min-h-[100dvh] bg-white text-zinc-950">{children}</div>;
  }

  const isSchedule = pathname === '/schedule' || pathname?.startsWith('/schedule/');

  return (
    <div className="min-h-[100dvh] bg-[#fbfbfa] text-zinc-950">
      <AppSidebar
        pathname={pathname}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed(!collapsed)}
      />
      <MobileHeader />

      <main className={clsx('min-h-[100dvh] pb-24 transition-[padding] duration-200 ease-out lg:pb-0', shellOffsetClass)}>
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
