'use client';

import { useEffect, useRef } from 'react';
import type { AuthChangeEvent } from '@supabase/supabase-js';
import { analyticsAllowed, identify, initPostHog, reset, setAccountAttribution, track } from '@/lib/analytics/posthog-client';
import { readTouch } from '@/lib/analytics/attribution';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/AuthProvider';

export default function PostHogIdentityBridge(): null {
  const { user, loading } = useAuth();
  const lastIdentifiedUserId = useRef<string | null>(null);
  useEffect(() => { initPostHog(); }, []);
  useEffect(() => {
    const { data: { subscription } } = createBrowserSupabaseClient().auth.onAuthStateChange((event: AuthChangeEvent) => {
      // Initial null sessions are not logout.
      if (event === 'SIGNED_OUT') { reset(); lastIdentifiedUserId.current = null; }
    });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (loading || !user?.id || lastIdentifiedUserId.current === user.id) return;
    if (lastIdentifiedUserId.current && lastIdentifiedUserId.current !== user.id) reset();
    // Identify before profile network requests; retain SDK anonymous linking.
    identify({ id: user.id, email: user.email, created_at: user.created_at });
    lastIdentifiedUserId.current = user.id;
    void fetch('/api/acquisition', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'associate', touch: analyticsAllowed() ? readTouch() : null, analytics_consent: analyticsAllowed() }),
    }).then(async response => {
      if (!response.ok) throw new Error('Attribution association failed');
      const result = await response.json();
      if (lastIdentifiedUserId.current !== user.id || !analyticsAllowed()) return;
      setAccountAttribution(result.first_touch, result.source);
      if (result.emit_signup) track('user_signed_up', { account_created_at: user.created_at, measured_source: result.source });
      else track('user_logged_in', { measured_source: result.source });
    }).catch(error => console.warn('[acquisition] association unavailable', error));
  }, [user, loading]);
  return null;
}
