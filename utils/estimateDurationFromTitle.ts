// utils/estimateDurationFromTitle.ts
export default function estimateDurationFromTitle(title?: string | null): number {
  if (!title || typeof title !== 'string') return 0;
  const match = title.match(/(\d+)\s*min/i);
  return match ? parseInt(match[1], 10) : 0;
}
