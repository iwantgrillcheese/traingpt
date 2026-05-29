'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import type { AuthChangeEvent, Session as SupabaseSession } from '@supabase/supabase-js';

type ProfileAvatarProps = {
  variant?: 'compact' | 'sidebar';
};

function getInitials(user: User | null) {
  const fullName = String(user?.user_metadata?.full_name ?? '').trim();
  const email = String(user?.email ?? '').trim();

  if (fullName) {
    const parts = fullName.split(/\s+/).filter(Boolean);
    const first = parts[0]?.[0] ?? '';
    const second = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
    return `${first}${second}`.toUpperCase();
  }

  if (email) return email[0]?.toUpperCase() ?? 'U';

  return 'U';
}

function getDisplayName(user: User | null) {
  const fullName = String(user?.user_metadata?.full_name ?? '').trim();
  if (fullName) return fullName;

  const email = String(user?.email ?? '').trim();
  if (email) return email.split('@')[0] || 'Account';

  return 'Account';
}

export default function ProfileAvatar({ variant = 'compact' }: ProfileAvatarProps) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadUser = async () => {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!cancelled) {
        setUser(currentUser ?? null);
      }
    };

    loadUser();

    const {
      data: { subscription },
} = supabase.auth.onAuthStateChange(
  (_event: AuthChangeEvent, session: SupabaseSession | null) => {
    setUser(session?.user ?? null);
  }
);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current) return;

      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const initials = useMemo(() => getInitials(user), [user]);
  const displayName = useMemo(() => getDisplayName(user), [user]);
  const email = user?.email ?? '';

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      await supabase.auth.signOut();
      router.replace('/login');
      router.refresh();
    } catch (error) {
      console.error('[ProfileAvatar] sign out failed:', error);
      setSigningOut(false);
    }
  };

  if (!user) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
      >
        Sign in
      </Link>
    );
  }

  if (variant === 'sidebar') {
    return (
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="flex w-full items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 text-left transition hover:border-zinc-300 hover:bg-zinc-50"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-xs font-semibold text-white">
            {initials}
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-zinc-950">{displayName}</span>
            <span className="block truncate text-xs text-zinc-500">{email}</span>
          </span>

          <span className="text-zinc-400">⌄</span>
        </button>

        {menuOpen ? (
          <div
            role="menu"
            className="absolute bottom-[calc(100%+8px)] left-0 z-50 w-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_18px_50px_rgba(24,24,27,0.14)]"
          >
            <div className="border-b border-zinc-100 px-4 py-3">
              <div className="truncate text-sm font-medium text-zinc-950">{displayName}</div>
              <div className="mt-0.5 truncate text-xs text-zinc-500">{email}</div>
            </div>

            <Link
              href="/settings"
              role="menuitem"
              onClick={() => setMenuOpen(false)}
              className="block px-4 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-950"
            >
              Settings
            </Link>

            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              disabled={signingOut}
              className="block w-full px-4 py-3 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {signingOut ? 'Signing out…' : 'Log out'}
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-950 text-[11px] font-semibold text-white transition hover:bg-zinc-800"
        aria-label="Open account menu"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        {initials}
      </button>

      {menuOpen ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 overflow-hidden rounded-2xl border border-zinc-200 bg-white text-left shadow-[0_18px_50px_rgba(24,24,27,0.14)]"
        >
          <div className="border-b border-zinc-100 px-4 py-3">
            <div className="truncate text-sm font-medium text-zinc-950">{displayName}</div>
            <div className="mt-0.5 truncate text-xs text-zinc-500">{email}</div>
          </div>

          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setMenuOpen(false)}
            className="block px-4 py-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-950"
          >
            Settings
          </Link>

          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            disabled={signingOut}
            className="block w-full px-4 py-3 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {signingOut ? 'Signing out…' : 'Log out'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
