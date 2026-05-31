export async function exportCalendarClient() {
  const response = await fetch('/api/calendar/export', {
    method: 'GET',
    credentials: 'include',
    redirect: 'follow',
    cache: 'no-store',
  });

  const contentType = response.headers.get('content-type') ?? '';

  if (!response.ok || !contentType.includes('text/calendar')) {
    if (response.redirected && response.url) {
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

    window.alert(message);
    return;
  }

  const blob = await response.blob();
  const file = new File([blob], 'traingpt-training-plan.ics', {
    type: 'text/calendar',
  });

  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      files: [file],
      title: 'TrainGPT Training Plan',
      text: 'Import your TrainGPT training plan into your calendar.',
    });
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'traingpt-training-plan.ics';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
