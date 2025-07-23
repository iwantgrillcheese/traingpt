// utils/estimateDurationFromTitle.ts
export default function estimateDurationFromTitle(title?: string | null): number {
  if (!title || typeof title !== 'string') return 0;

  // Match hours and minutes like "3h", "90min", "25 mins"
  const hourMatch = title.match(/(\d+(?:\.\d+)?)\s*h/i);
  const minMatch = title.match(/(\d+)\s*(min|mins)/i);

  let totalMinutes = 0;

  if (hourMatch) {
    totalMinutes += parseFloat(hourMatch[1]) * 60;
  }

  if (minMatch) {
    totalMinutes += parseInt(minMatch[1], 10);
  }

  return Math.round(totalMinutes);
}
