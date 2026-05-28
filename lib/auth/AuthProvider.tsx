'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  isAuthenticated: false,
  refresh: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  const mountedRef = useRef(false);

  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const {
        data: { session: nextSession },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error('[AuthProvider] getSession failed:', error);
      }

      if (!mountedRef.current) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
    } catch (error) {
      console.error('[AuthProvider] unexpected auth refresh error:', error);

      if (!mountedRef.current) return;

      setSession(null);
      setUser(null);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [supabase]);

  useEffect(() => {
    mountedRef.current = true;

    refresh();

   const {
  data: { subscription },
} = supabase.auth.onAuthStateChange(
  (_event: AuthChangeEvent, nextSession: Session | null) => {
    if (!mountedRef.current) return;

    setSession(nextSession);
    setUser(nextSession?.user ?? null);
    setLoading(false);
  }
);

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [refresh, supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      loading,
      isAuthenticated: !!user,
      refresh,
    }),
    [user, session, loading, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}