'use client';

import posthog from 'posthog-js';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';

let initialized = false;

export function initPostHog() {
  if (initialized) return;
  if (typeof window === 'undefined') return;
  if (!POSTHOG_KEY) return;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false,
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
    autocapture: false,
  });

  initialized = true;
}

export function identify(user: {
  id: string;
  email?: string | null;
  created_at?: string | null;
  has_strava?: boolean;
  has_plan?: boolean;
}) {
  if (!initialized || !user?.id) return;
  posthog.identify(user.id, {
    email: user.email ?? undefined,
    created_at: user.created_at ?? undefined,
    has_strava: !!user.has_strava,
    has_plan: !!user.has_plan,
  });
}

export function track(event: string, properties?: Record<string, any>) {
  if (!initialized) return;
  posthog.capture(event, properties ?? {});
}

export function reset() {
  if (!initialized) return;
  posthog.reset();
}
