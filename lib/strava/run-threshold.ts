export type RunActivity = {
  name: string | null;
  distance: number | null;
  moving_time: number | null;
  start_date: string | null;
  average_heartrate: number | null;
  elapsed_time?: number | null;
  workout_type?: number | null;
};
type Confidence = 'low' | 'medium' | 'high';
const DAY = 86400000;
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const positive = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
const format = (n: number) => {
  const rounded = Math.round(n);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')} / mi`;
};

/** Suggestions only. Never writes a profile. Unknown stored provenance is authoritative. */
export function estimateRunThreshold(runs: RunActivity[], stored?: number | null, now = Date.now()) {
  const anchor = positive(stored) ? stored : null;
  const result = (pace: number | null, confidence: Confidence, rationale: string) => ({
    discipline: 'run' as const, label: 'Run threshold pace',
    value: pace === null ? 'Not enough consistent run data' : format(pace), confidence, rationale,
  });
  const insufficient = (why: string) => result(anchor, 'low', `${why} ${anchor ? 'Keeping your stored threshold; manual values remain authoritative.' : 'Not enough consistent run data. Enter a known threshold or connect more sustained runs.'}`);
  const recent = runs.filter(row => {
    const date = Date.parse(row.start_date ?? '');
    return Number.isFinite(date) && date <= now && date >= now - 56 * DAY;
  });
  const hrs = recent.map(r => r.average_heartrate).filter(positive).filter(n => n >= 60 && n <= 220);
  const hrBaseline = hrs.length >= 3 ? median(hrs) : null;
  let abnormal = 0;
  const candidates = recent.flatMap(row => {
    if (!positive(row.distance) || !positive(row.moving_time) || row.moving_time < 1200 || row.distance < 3000) return [];
    const duration = positive(row.elapsed_time) ? Math.max(row.elapsed_time, row.moving_time) : row.moving_time;
    const pace = duration / (row.distance / 1609.344);
    if (pace < 240 || pace > 900) return [];
    // Summary data cannot prove continuity or grade: reject known warning signs.
    if (/\b(intervals?|repeats?|fartlek|brick|downhill|recovery)\b|\d+\s*[x×]\s*\d+/i.test(row.name ?? '') ||
        (positive(row.elapsed_time) && (row.elapsed_time < row.moving_time || row.elapsed_time / row.moving_time > 1.1))) {
      abnormal++; return [];
    }
    const hr = row.average_heartrate;
    const hrSupport = hrBaseline !== null && positive(hr) && hr >= hrBaseline * 1.02 && hr <= 220;
    const lowHR = hrBaseline !== null && positive(hr) && hr < hrBaseline * .90;
    // Strava Run workout_type=1 explicitly identifies a race; distance alone never does.
    const race = row.workout_type === 1;
    // Riegel's distance/time exponent 1.06, projected to an approximately one-hour effort.
    const estimate = race ? pace * Math.pow(3600 / duration, .06 / 1.06) : pace * 1.03;
    return [{ row, pace, estimate, race, hrSupport, lowHR }];
  });
  if (!candidates.length) return insufficient('No usable sustained runs in the last 56 days.');
  const center = median(candidates.map(c => c.pace));
  const mad = median(candidates.map(c => Math.abs(c.pace - center)));
  const fastBoundary = center - Math.max(center * .12, 3 * mad);
  let outliers = 0;
  const retained = candidates.filter(c => {
    // Require independent recent support even for an exceptional race.
    const support = candidates.filter(other => other !== c && Math.abs(other.estimate - c.estimate) / c.estimate <= .06);
    if (c.pace < fastBoundary && support.length < 2) { outliers++; return false; }
    return !c.lowHR && c.pace <= center * 1.15;
  });
  if (!retained.length) return insufficient('Recent signals were abnormal or lacked physiological support.');
  // Use the fastest repeatable cluster, never the fastest isolated activity.
  const clusters = retained.map(seed => retained.filter(c => Math.abs(c.estimate - seed.estimate) / seed.estimate <= .04))
    .filter(group => new Set(group.map(c => c.row.start_date?.slice(0, 10))).size >= 2)
    .sort((a, b) => median(a.map(c => c.estimate)) - median(b.map(c => c.estimate)));
  const cluster = clusters[0];
  if (!cluster) return insufficient('Only isolated or conflicting recent signals were found.');
  const days = new Set(cluster.map(c => c.row.start_date?.slice(0, 10))).size;
  const weighted = cluster.flatMap(c => Array(c.race ? 3 : 1).fill(c.estimate) as number[]);
  let estimate = median(weighted);
  const contextual = cluster.filter(c => c.hrSupport || (c.race && positive(c.row.elapsed_time))).length;
  const strong = days >= 3 && contextual >= 2;
  let confidence: Confidence = strong ? 'high' : 'medium';
  if (outliers || abnormal) confidence = confidence === 'high' ? 'medium' : confidence;
  let rationale = `Estimated from ${days} consistent recent sustained run days between ${format(Math.min(...cluster.map(c => c.pace)))} and ${format(Math.max(...cluster.map(c => c.pace)))}.`;
  if (cluster.some(c => c.race)) rationale += ' Explicitly marked race performance received extra weight, supported by surrounding runs.';
  if (outliers) rationale += ` ${outliers} faster outlier activity(s) excluded.`;
  if (abnormal) rationale += ` ${abnormal} abnormal or interrupted activity(s) excluded.`;
  if (hrBaseline === null) rationale += ' HR context is limited; confirm this conservative estimate manually.';
  if (anchor !== null) {
    if (!strong && Math.abs(estimate - anchor) / anchor > .03) {
      estimate = Math.max(anchor * .97, Math.min(anchor * 1.03, estimate));
      confidence = 'low';
      rationale += ' Evidence does not support a large adjustment; the suggestion is capped at 3% from your stored threshold.';
    }
    rationale += ' This is a suggestion only; your stored/manual threshold remains authoritative.';
  }
  return result(estimate, confidence, rationale);
}
