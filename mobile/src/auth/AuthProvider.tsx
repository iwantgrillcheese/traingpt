import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as ExpoLinking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getApiBaseUrl } from '../lib/api';

WebBrowser.maybeCompleteAuthSession();

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function getQueryParam(url: string, key: string) {
  const queryStart = url.indexOf('?');
  const hashStart = url.indexOf('#');
  const query = queryStart >= 0 ? url.slice(queryStart + 1, hashStart >= 0 ? hashStart : undefined) : '';
  const hash = hashStart >= 0 ? url.slice(hashStart + 1) : '';
  const params = new URLSearchParams(`${query}${query && hash ? '&' : ''}${hash}`);
  return params.get(key);
}

function getNativeAuthRedirect() {
  return 'traingpt://auth/callback';
}

function getMobileAuthBridge() {
  return `${getApiBaseUrl()}/auth/mobile-callback`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const handleOAuthUrl = useCallback(async (url: string | null) => {
    if (!url) return;
    if (!url.startsWith('traingpt://') && !url.includes('/auth/callback') && !url.includes('/auth/mobile-callback')) return;

    const code = getQueryParam(url, 'code');
    const accessToken = getQueryParam(url, 'access_token');
    const refreshToken = getQueryParam(url, 'refresh_token');
    const errorDescription = getQueryParam(url, 'error_description') ?? getQueryParam(url, 'error');

    try {
      if (errorDescription) throw new Error(errorDescription);

      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
        setSession(data.session ?? null);
        return;
      }

      if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) throw error;
        setSession(data.session ?? null);
      }
    } catch (error) {
      console.error('[AuthProvider] OAuth callback failed', error);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setLoading(false);
    });

    ExpoLinking.getInitialURL().then((url) => {
      if (mounted) handleOAuthUrl(url);
    });

    const urlSubscription = Linking.addEventListener('url', ({ url }) => {
      handleOAuthUrl(url);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      urlSubscription.remove();
      listener.subscription.unsubscribe();
    };
  }, [handleOAuthUrl]);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    loading,
    async signInWithEmail(email: string, password: string) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error ? { error: error.message } : {};
    },
    async signInWithGoogle() {
      const nativeRedirect = getNativeAuthRedirect();
      const redirectTo = getMobileAuthBridge();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (error) return { error: error.message };
      if (!data?.url) return { error: 'Could not start Google sign-in.' };

      const result = await WebBrowser.openAuthSessionAsync(data.url, nativeRedirect);
      if (result.type === 'success') {
        await handleOAuthUrl(result.url);
        return {};
      }

      if (result.type === 'cancel') return { error: 'Google sign-in was cancelled.' };
      return {};
    },
    async signOut() {
      await supabase.auth.signOut();
    },
  }), [handleOAuthUrl, loading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
