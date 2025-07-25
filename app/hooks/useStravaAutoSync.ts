'use client';

import { useEffect, useState } from 'react';

export function useStravaAutoSync() {
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const success = url.searchParams.get('success');

    if (success === 'strava_connected' && !synced) {
      fetch('/api/strava_sync', { method: 'POST' }).then(() => {
        console.log('✅ Strava sync triggered');
        setSynced(true);

        // Clean up the URL to avoid re-triggering
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('success');
        window.history.replaceState({}, '', newUrl.toString());
      });
    }
  }, [synced]);
}
