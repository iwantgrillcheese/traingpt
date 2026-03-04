'use client';

import { useEffect, useRef } from 'react';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { identify, initPostHog, reset, track } from '@/lib/analytics/posthog-client';

export default function PostHogIdentityBridge({
  supabaseClient,
}: {
  supabaseClient: SupabaseClient<any, 'public', any>;
}) {
  const lastIdentifiedUserId = useRef<string | null>(null);

  useEffect(() => {
    initPostHog();

    const syncIdentity = async (user: User | null) => {
      if (!user?.id) {
        lastIdentifiedUserId.current = null;
        return;
      }

      const [{ data: profileData }, { data: latestPlanData }] = await Promise.all([
        supabaseClient
          .from('profiles')
          .select('strava_access_token')
          .eq('id', user.id)
          .maybeSingle(),
        supabaseClient
          .from('plans')
          .select('id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      identify({
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        has_strava: !!profileData?.strava_access_token,
        has_plan: !!latestPlanData?.id,
      });

      lastIdentifiedUserId.current = user.id;
    };

    supabaseClient.auth.getSession().then(async ({ data }) => {
      await syncIdentity(data.session?.user ?? null);
    });

    const { data: sub } = supabaseClient.auth.onAuthStateChange(async (event, session) => {
      const user = session?.user ?? null;

      if (event === 'SIGNED_OUT') {
        reset();
        lastIdentifiedUserId.current = null;
        return;
      }

      if (event === 'SIGNED_IN' && user) {
        await syncIdentity(user);

        const createdAt = new Date(user.created_at || 0).getTime();
        const lastSignInAt = new Date(user.last_sign_in_at || 0).getTime();
        const looksLikeSignup =
          Number.isFinite(createdAt) &&
          Number.isFinite(lastSignInAt) &&
          Math.abs(lastSignInAt - createdAt) < 120000;

        track(looksLikeSignup ? 'user_signed_up' : 'user_logged_in');
        return;
      }

      if (user && lastIdentifiedUserId.current !== user.id) {
        await syncIdentity(user);
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [supabaseClient]);

  return null;
}
