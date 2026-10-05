'use client';

import posthog from 'posthog-js';
import { analyticsEnvironment, captureTouch, clearTouch, excludedReferrer, readTouch, rememberTouch, safePath, safeUrl, sourceOf } from './attribution';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';

let initialized = false;
let accountSource: string | null = null;

export function analyticsAllowed() {
  return initialized && !posthog.has_opted_out_capturing();
}

export function captureFirstTouch() {
  if (!analyticsAllowed()) { if (initialized) clearTouch(); return null; }
  const previous = readTouch();
  if (previous) return previous;
  const touch = captureTouch(window.location.href, document.referrer);
  if (touch) rememberTouch(touch);
  return touch;
}

export function initPostHog() {
  if (initialized) return;
  if (typeof window === 'undefined') return;
  if (!POSTHOG_KEY) return;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false,
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
    cross_subdomain_cookie: true,
    autocapture: false,
    before_send: (event) => {
      if (!event) return event;
      const sanitize = (properties: Record<string, unknown>) => {
        for (const key of Object.keys(properties)) {
          const value = properties[key];
          if (/referring_domain/.test(key) && typeof value === 'string' && excludedReferrer(value)) properties[key] = '$direct';
          if (/url|referrer/.test(key) && typeof value === 'string' && /^https?:/.test(value)) properties[key] = safeUrl(value);
          if (/referrer/.test(key) && typeof value === 'string' && /^https?:/.test(value)) {
            try { if (excludedReferrer(new URL(value).hostname)) properties[key] = '$direct'; } catch { properties[key] = '$direct'; }
          }
          if ((key === 'path' || /pathname/.test(key)) && typeof value === 'string') properties[key] = safePath(value.split('?')[0]);
          if ((key === '$set' || key === '$set_once') && value && typeof value === 'object') sanitize(value as Record<string, unknown>);
        }
      };
      sanitize(event.properties);
      event.properties.environment = analyticsEnvironment(window.location.hostname, process.env.NEXT_PUBLIC_VERCEL_ENV);
      return event;
    },
  });

  initialized = true;
  captureFirstTouch();
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
    ...(user.has_strava === undefined ? {} : { has_strava: user.has_strava }),
    ...(user.has_plan === undefined ? {} : { has_plan: user.has_plan }),
  });
}

export function track(event: string, properties?: Record<string, unknown>) {
  if (!analyticsAllowed()) return;
  return posthog.capture(event, { measured_source: accountSource ?? sourceOf(readTouch()), ...properties });
}

export function setAccountAttribution(touch: unknown, source: string) {
  if (!analyticsAllowed()) return;
  accountSource = source;
  posthog.register({ measured_source: source });
  posthog.setPersonProperties({}, { acquisition_first_touch: touch, acquisition_source: source });
}

export function reset() {
  if (!initialized) return;
  posthog.reset();
  accountSource = null;
  clearTouch();
}
