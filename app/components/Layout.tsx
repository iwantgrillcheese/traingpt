"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import ProfileAvatar from "./ProfileAvatar";

const APP_ROUTES = ["/schedule", "/coaching", "/plan", "/settings"];
const SIDEBAR_STORAGE_KEY = "traingpt.sidebarCollapsed";

const DESKTOP_NAV_ITEMS = [
  { label: "Schedule", href: "/schedule", shortLabel: "S", icon: "▦" },
  { label: "Coach", href: "/coaching", shortLabel: "C", icon: "◈" },
  { label: "Plan builder", href: "/plan", shortLabel: "B", icon: "◎" },
  { label: "Settings", href: "/settings", shortLabel: "⚙", icon: "⚙" },
];

const MOBILE_PRIMARY_NAV_ITEMS = [
  { label: "Schedule", href: "/schedule", icon: "▦" },
  { label: "Coach", href: "/coaching", icon: "◈" },
  { label: "Builder", href: "/plan", icon: "◎" },
];

function isAppRoute(pathname: string | null) {
  if (!pathname) return false;
  return APP_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
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
      if (stored === "true") setCollapsed(true);
      if (stored === "false") setCollapsed(false);
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

function BrandLockup({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link
      href="/schedule"
      className={clsx("flex items-center gap-3", collapsed && "justify-center")}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-[#2563FF] text-[13px] font-black tracking-[-0.08em] text-white shadow-[0_12px_30px_rgba(37,99,255,0.22)]">
        TG
      </span>
      {!collapsed ? (
        <span className="min-w-0">
          <span className="block text-[16px] font-black tracking-[-0.04em] text-[#101114]">
            TrainGPT
          </span>
          <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-[#9CA3AF]">
            Adaptive coach
          </span>
        </span>
      ) : null}
    </Link>
  );
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
        "hidden border-r border-[#E3E0D8] bg-[#F7F6F2]/95 lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:flex-col lg:transition-[width] lg:duration-200 lg:ease-out",
        collapsed ? "lg:w-[72px]" : "lg:w-[248px]",
      )}
    >
      <div
        className={clsx(
          "flex items-center border-b border-[#E3E0D8]",
          collapsed ? "justify-center px-2 py-4" : "justify-between px-4 py-5",
        )}
      >
        <BrandLockup collapsed={collapsed} />

        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={clsx(
            "inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E3E0D8] bg-white text-[#6B7280] transition hover:border-[#CFCBC1] hover:text-[#101114]",
            collapsed && "absolute bottom-4",
          )}
        >
          <span aria-hidden="true" className="text-[15px] leading-none">
            {collapsed ? "›" : "‹"}
          </span>
        </button>
      </div>

      <nav
        className={clsx(
          "flex flex-1 flex-col text-sm",
          collapsed ? "px-2 py-4" : "px-3 py-4",
        )}
      >
        <div className="space-y-1.5">
          {DESKTOP_NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                aria-label={collapsed ? item.label : undefined}
                className={clsx(
                  "group flex items-center rounded-2xl font-bold transition-all",
                  collapsed
                    ? "h-11 justify-center px-0 text-[13px]"
                    : "gap-3 px-3 py-2.5 text-[14px]",
                  active
                    ? "bg-[#EAF0FF] text-[#2563FF] shadow-[inset_0_0_0_1px_rgba(37,99,255,0.10)]"
                    : "text-[#6B7280] hover:bg-white hover:text-[#101114]",
                )}
              >
                <span
                  className={clsx(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-xl text-[13px]",
                    active
                      ? "bg-white text-[#2563FF]"
                      : "bg-white/60 text-[#9CA3AF] group-hover:text-[#101114]",
                  )}
                >
                  {collapsed ? item.shortLabel : item.icon}
                </span>
                {!collapsed ? <span>{item.label}</span> : null}
              </Link>
            );
          })}
        </div>

        {!collapsed ? (
          <div className="mt-5 rounded-[1.35rem] border border-[#D7DDFF] bg-[#EAF0FF] p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#2563FF]">
              Race readiness
            </p>
            <p className="mt-2 text-2xl font-black tracking-[-0.06em] text-[#101114]">
              Build to 80+
            </p>
            <p className="mt-1 text-xs leading-5 text-[#46506A]">
              Do the work, bank the proof, adapt the week.
            </p>
          </div>
        ) : null}

        <div
          className={clsx(
            "mt-auto border-t border-[#E3E0D8] pt-3",
            collapsed && "flex justify-center",
          )}
        >
          <ProfileAvatar variant={collapsed ? "rail" : "sidebar"} />
        </div>
      </nav>
    </aside>
  );
}

function MobileHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#E3E0D8] bg-[#F7F6F2]/92 backdrop-blur lg:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <BrandLockup />
        <ProfileAvatar variant="compact" />
      </div>
    </header>
  );
}

function MobileBottomNav({ pathname }: { pathname: string | null }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const settingsActive = isActive(pathname, "/settings");

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
        <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-50 overflow-hidden rounded-3xl border border-[#E3E0D8] bg-white shadow-[0_24px_80px_rgba(16,17,20,0.18)] lg:hidden">
          <div className="border-b border-[#E3E0D8] px-4 py-3">
            <div className="text-sm font-black text-[#101114]">More</div>
            <div className="mt-0.5 text-xs text-[#6B7280]">
              Account and product settings
            </div>
          </div>

          <div className="p-2">
            <Link
              href="/settings"
              onClick={() => setMoreOpen(false)}
              className={clsx(
                "flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-bold transition-colors",
                settingsActive
                  ? "bg-[#2563FF] text-white"
                  : "text-[#4B5563] hover:bg-[#F7F6F2] hover:text-[#101114]",
              )}
            >
              <span>Settings</span>
              <span
                className={settingsActive ? "text-white/60" : "text-[#9CA3AF]"}
              >
                ›
              </span>
            </Link>

            <div className="mt-2 rounded-2xl border border-[#E3E0D8] bg-[#F7F6F2] p-2">
              <ProfileAvatar variant="sidebar" />
            </div>
          </div>
        </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-[#E3E0D8] bg-white/96 px-2 pb-[calc(env(safe-area-inset-bottom)+6px)] pt-2 shadow-[0_-12px_40px_rgba(16,17,20,0.08)] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
          {MOBILE_PRIMARY_NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex h-12 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-black transition-colors",
                  active
                    ? "bg-[#EAF0FF] text-[#2563FF]"
                    : "text-[#6B7280] active:bg-[#F7F6F2] active:text-[#101114]",
                )}
              >
                <span className="text-[13px] leading-none">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen((open) => !open)}
            className={clsx(
              "flex h-12 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-black transition-colors",
              moreOpen || settingsActive
                ? "bg-[#EAF0FF] text-[#2563FF]"
                : "text-[#6B7280] active:bg-[#F7F6F2] active:text-[#101114]",
            )}
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
          >
            <span className="text-[13px] leading-none">•••</span>
            <span>More</span>
          </button>
        </div>
      </nav>
    </>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { collapsed, setCollapsed } = useSidebarCollapsed();

  const shellOffsetClass = useMemo(
    () => (collapsed ? "lg:pl-[72px]" : "lg:pl-[248px]"),
    [collapsed],
  );

  // One-time signup welcome. The server claims the send atomically via
  // profiles.welcome_email_sent_at, so this is safe to fire on every hard
  // load; sessionStorage just saves the network call within a session.
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem("tg.signupEmailChecked")) return;
      window.sessionStorage.setItem("tg.signupEmailChecked", "1");
    } catch {
      // private mode etc. — server idempotency still protects us
    }
    void fetch("/api/send-email/signup", { method: "POST" }).catch(() => {});
  }, []);

  if (!isAppRoute(pathname)) {
    return (
      <div className="min-h-[100dvh] bg-white text-[#101114]">{children}</div>
    );
  }

  const isSchedule =
    pathname === "/schedule" || pathname?.startsWith("/schedule/");

  return (
    <div className="min-h-[100dvh] bg-[#F7F6F2] text-[#101114]">
      <AppSidebar
        pathname={pathname}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed(!collapsed)}
      />
      <MobileHeader />

      <main
        className={clsx(
          "min-h-[100dvh] pb-24 transition-[padding] duration-200 ease-out lg:pb-0",
          shellOffsetClass,
        )}
      >
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
