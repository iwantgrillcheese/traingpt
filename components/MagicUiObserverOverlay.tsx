'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import MagicLoadingOverlay from './MagicLoadingOverlay';

type MagicMode = 'plan' | 'strava' | null;

function detectMagicStateFromPage() {
  if (typeof document === 'undefined') return null;

  const bodyClone = document.body.cloneNode(true) as HTMLElement;
  bodyClone.querySelectorAll('[data-training-processing-overlay="true"]').forEach((node) => node.remove());

  const text = bodyClone.innerText?.toLowerCase() ?? '';

  if (text.includes('generating your plan')) return 'plan' as const;
  if (text.includes('syncing activities') || text.includes('syncing your latest activities')) return 'strava' as const;

  return null;
}

function hasExplicitStravaSyncParam() {
  if (typeof window === 'undefined') return false;

  const params = new URLSearchParams(window.location.search);
  return params.get('sync') === 'needed' && params.get('source') === 'strava';
}

export default function MagicUiObserverOverlay() {
  const pathname = usePathname();
  const [mode, setMode] = useState<MagicMode>(null);
  const suppressStravaUntilPathChangeRef = useRef(false);

  useEffect(() => {
    suppressStravaUntilPathChangeRef.current = false;
  }, [pathname]);

  useEffect(() => {
    if (pathname !== '/plan') {
      setMode(null);
      return;
    }

    const explicitStravaSync = hasExplicitStravaSyncParam();
    if (explicitStravaSync && !suppressStravaUntilPathChangeRef.current) {
      setMode('strava');
    }

    const update = () => {
      const detected = detectMagicStateFromPage();

      if (detected === 'plan') {
        setMode('plan');
        return;
      }

      if (detected === 'strava' || explicitStravaSync) {
        setMode(suppressStravaUntilPathChangeRef.current ? null : 'strava');
        return;
      }

      setMode(null);
    };

    update();

    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    // Strava sync should feel polished, but it should never trap the user.
    // If the callback param or background state hangs, dismiss the overlay and let sync finish in the background.
    const stravaDismissTimer = window.setTimeout(() => {
      suppressStravaUntilPathChangeRef.current = true;
      setMode((current) => (current === 'strava' ? null : current));
    }, 10500);

    return () => {
      observer.disconnect();
      window.clearTimeout(stravaDismissTimer);
    };
  }, [pathname]);

  return (
    <MagicLoadingOverlay
      visible={Boolean(mode)}
      mode={mode === 'strava' ? 'strava' : 'plan'}
      title={mode === 'strava' ? 'Syncing your Strava history.' : 'Building your training calendar.'}
      subtitle={
        mode === 'strava'
          ? 'TrainGPT is reading your recent activities and turning them into useful context for your plan.'
          : 'TrainGPT is building your plan week by week, checking progression, recovery, and race-specific sessions.'
      }
    />
  );
}
