'use client';

import { useEffect, useRef } from 'react';
import { identify, initPostHog, reset, track } from '@/lib/analytics/posthog-client';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/AuthProvider';

export default function PostHogIdentityBridge() {
  const { user } = useAuth();
  const supabase = createBrowserSupabaseClient();

  const lastIdentifiedUserId = useRef<string | null>(null);
  const trackedLoginForUserId = useRef<string | null>(null);

  useEffect(() => {
    initPostHog();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const syncIdentity = async () => {
      if (!user?.id) {
        reset();
        lastIdentifiedUserId.current = null;
        trackedLoginForUserId.current = null;
        return;
      }

      if (lastIdentifiedUserId.current === user.id) {
        return;
      }

      try {
        const [{ data: profileData }, { data: latestPlanData }] = await Promise.all([
          supabase
            .from('profiles')
            .select('strava_access_token')
            .eq('id', user.id)
            .maybeSingle(),
          supabase
            .from('plans')
            .select('id')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        if (cancelled) return;

        identify({
          id: user.id,
          email: user.email,
          created_at: user.created_at,
          has_strava: !!profileData?.strava_access_token,
          has_plan: !!latestPlanData?.id,
        });

        lastIdentifiedUserId.current = user.id;

        if (trackedLoginForUserId.current !== user.id) {
          const createdAt = new Date(user.created_at || 0).getTime();
          const lastSignInAt = new Date(user.last_sign_in_at || 0).getTime();

          const looksLikeSignup =
            Number.isFinite(createdAt) &&
            Number.isFinite(lastSignInAt) &&
            Math.abs(lastSignInAt - createdAt) < 120000;

          track(looksLikeSignup ? 'user_signed_up' : 'user_logged_in');
          trackedLoginForUserId.current = user.id;
        }
      } catch (error) {
        console.error('[PostHogIdentityBridge] identity sync failed:', error);
      }
    };

    syncIdentity();

    return () => {
      cancelled = true;
    };
  }, [user, supabase]);

  return null;
}