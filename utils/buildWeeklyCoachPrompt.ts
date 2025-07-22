import type { WeeklyComparison } from './buildWeeklyComparison';

type Baseline = {
  bike_ftp?: number;
  run_threshold?: number; // in sec/mile
  swim_css?: number; // in sec/100m
  pace_units?: 'mile' | 'km';
};

export function buildWeeklyCoachPrompt(
  comparisons: WeeklyComparison[],
  baseline: Baseline,
  weekStart: string
): string {
  const completed = comparisons.filter((s) => s.status?.startsWith('✅'));
  const missed = comparisons.filter((s) => s.status?.startsWith('⚠️'));

  const completedText = completed.length
    ? completed
        .map(
          (c) =>
            `• ${c.date} — ${c.sport || 'Session'}: ${c.title || 'Untitled'} — Actual: ${Math.round(
              c.actualDuration || 0
            )}min${formatDelta(c)} (${c.status})`
        )
        .join('\n')
    : 'None';

  const missedText = missed.length
    ? missed
        .map(
          (c) => `• ${c.date} — ${c.sport || 'Session'}: ${c.title || 'Untitled'} (${c.status})`
        )
        .join('\n')
    : 'None';

  const baselineText = `Baseline Metrics:\n• FTP: ${baseline.bike_ftp || 'N/A'}W\n• Threshold Pace: ${formatPace(
    baseline.run_threshold
  )} per ${baseline.pace_units || 'mile'}\n• Swim CSS: ${formatSwim(baseline.swim_css)} /100m`;

  return `
Athlete Weekly Summary
Week of: ${weekStart}

✅ Completed Sessions:
${completedText}

⚠️ Missed or Skipped Sessions:
${missedText}

${baselineText}

Instructions:
Write a 4–6 sentence coaching summary for this athlete. Include:
- What went well this week
- Any patterns or red flags
- Suggestions for next week
Be specific and supportive. Use a coaching tone.`;
}

function formatDelta(c: WeeklyComparison): string {
  if (c.sport === 'Run' && typeof c.paceDelta === 'number') {
    const sec = Math.round(c.paceDelta);
    return ` (${sec >= 0 ? '+' : ''}${sec}s/mi vs threshold)`;
  }
  if (c.sport === 'Bike' && typeof c.powerDelta === 'number') {
    return ` (${c.powerDelta >= 0 ? '+' : ''}${Math.round(c.powerDelta)}W vs FTP)`;
  }
  return '';
}

function formatPace(seconds?: number): string {
  if (!seconds) return 'N/A';
  const min = Math.floor(seconds / 60);
  const sec = Math.round(seconds % 60).toString().padStart(2, '0');
  return `${min}:${sec}`;
}

function formatSwim(seconds?: number): string {
  if (!seconds) return 'N/A';
  const min = Math.floor(seconds / 60);
  const sec = Math.round(seconds % 60).toString().padStart(2, '0');
  return `${min}:${sec}`;
}
