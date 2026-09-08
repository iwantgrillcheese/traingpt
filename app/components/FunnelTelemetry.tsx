'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { initPostHog, track } from '@/lib/analytics/posthog-client';

function once(key: string, event: string, properties: Record<string, unknown>) {
  try {
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, '1');
  } catch {
    // Event is still useful even if browser persistence is unavailable.
  }
  track(event, properties);
}

export default function FunnelTelemetry() {
  const pathname = usePathname();

  useEffect(() => {
    initPostHog();
    track('page_viewed', { path: pathname || '/' });
    if (pathname === '/') track('landing_viewed', { path: '/' });
    if (pathname === '/plan') track('onboarding_started', { path: '/plan' });
  }, [pathname]);

  useEffect(() => {
    let active = true;
    (async () => {
      initPostHog();
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user?.id || !active) return;

      const [{ data: profile }, { data: plan }, { count: sessionCount }, { count: completedCount }] = await Promise.all([
        supabase.from('profiles').select('strava_access_token,strava_last_synced_at').eq('id', user.id).maybeSingle(),
        supabase.from('plans').select('id,race_type,race_date').eq('user_id', user.id).limit(1).maybeSingle(),
        supabase.from('sessions').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('completed_sessions').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      ]);

      if (!active) return;
      const createdAt = user.created_at || null;
      const ageDays = createdAt ? Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000)) : null;
      const hasPlan = Boolean((plan as any)?.id);
      const hasStrava = Boolean((profile as any)?.strava_access_token);
      const hasCompleted = Number(completedCount ?? 0) > 0;

      const properties = {
        account_age_days: ageDays,
        has_plan: hasPlan,
        has_strava: hasStrava,
        strava_last_synced_at: (profile as any)?.strava_last_synced_at ?? null,
        planned_session_count: Number(sessionCount ?? 0),
        completed_session_count: Number(completedCount ?? 0),
        has_completed_session: hasCompleted,
        race_type: (plan as any)?.race_type ?? null,
        race_date: (plan as any)?.race_date ?? null,
      };

      track('funnel_snapshot', properties);
      if (hasPlan) once(`brick:milestone:plan:${user.id}`, 'activation_plan_present', properties);
      if (hasStrava) once(`brick:milestone:strava:${user.id}`, 'activation_strava_connected', properties);
      if (hasCompleted) once(`brick:milestone:completion:${user.id}`, 'activation_first_completion', properties);
      if (ageDays !== null && ageDays >= 7) once(`brick:retention:w1:${user.id}`, 'retention_week_1_seen', properties);
      if (ageDays !== null && ageDays >= 14) once(`brick:retention:w2:${user.id}`, 'retention_week_2_seen', properties);
      if (ageDays !== null && ageDays >= 28) once(`brick:retention:w4:${user.id}`, 'retention_week_4_seen', properties);
    })().catch((error) => console.warn('[funnel] snapshot failed', error));

    return () => { active = false; };
  }, [pathname]);

  return null;
}
