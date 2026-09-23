import { track } from '@/lib/analytics/posthog-client';

function trackExport(event: string, properties: Record<string, string | number>) {
  // Analytics must never stop an athlete from downloading their plan.
  try { track(event, properties); } catch { /* best-effort telemetry */ }
}

export async function exportCalendarClient(source = 'schedule') {
  trackExport('calendar_export_clicked', { source });
  let status = 0;
  try {
    const response = await fetch('/api/calendar/export', {
      method: 'GET',
      credentials: 'include',
      redirect: 'follow',
      cache: 'no-store',
    });
    status = response.status;

    const contentType = response.headers.get('content-type') ?? '';

    if (!response.ok || !contentType.includes('text/calendar')) {
      if (response.redirected && response.url) {
        trackExport('calendar_export_redirected', { source, status });
        window.location.href = response.url;
        return;
      }

      let message = 'Could not export your calendar. Please try again.';
      try {
        const payload = await response.json();
        if (typeof payload?.error === 'string') message = payload.error;
      } catch {
        // Non-JSON error response. Keep the friendly fallback.
      }

      throw new Error(message);
    }

    const blob = await response.blob();
    const file = new File([blob], 'traingpt-training-plan.ics', {
      type: 'text/calendar',
    });

    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'TrainGPT Training Plan',
          text: 'Import your TrainGPT training plan into your calendar.',
        });
        trackExport('calendar_export_handoff', { source, method: 'share', bytes: blob.size });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          trackExport('calendar_export_cancelled', { source });
          return;
        }
        // Some browsers lose transient share permission while fetching the file.
        // Fall back to download instead of treating a valid export as a failure.
      }
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'traingpt-training-plan.ics';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    // This confirms handoff to the browser, NOT import into a calendar app.
    trackExport('calendar_export_handoff', { source, method: 'download', bytes: blob.size });
  } catch (error) {
    trackExport('calendar_export_failed', { source, status });
    window.alert(error instanceof Error ? error.message : 'Could not export your calendar. Please try again.');
  }
}
