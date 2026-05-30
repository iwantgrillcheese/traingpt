'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import MagicLoadingOverlay from './MagicLoadingOverlay';

type MagicMode = 'plan' | 'strava' | null;

function detectMagicStateFromPage() {
  if (typeof document === 'undefined') return null;

  const text = document.body?.innerText?.toLowerCase() ?? '';

  if (text.includes('generating your plan')) return 'plan' as const;
  if (text.includes('syncing activities') || text.includes('syncing your latest activities')) return 'strava' as const;

  return null;
}

export default function MagicUiObserverOverlay() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<MagicMode>(null);

  useEffect(() => {
    if (pathname !== '/plan') {
      setMode(null);
      return;
    }

    const explicitStravaSync = searchParams?.get('sync') === 'needed' && searchParams?.get('source') === 'strava';
    if (explicitStravaSync) {
      setMode('strava');
    }

    const update = () => {
      const detected = detectMagicStateFromPage();
      setMode((current) => detected ?? (explicitStravaSync && current === 'strava' ? 'strava' : null));
    };

    update();

    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    const timer = window.setTimeout(() => {
      if (explicitStravaSync) setMode((current) => (current === 'strava' ? null : current));
    }, 9000);

    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [pathname, searchParams]);

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
