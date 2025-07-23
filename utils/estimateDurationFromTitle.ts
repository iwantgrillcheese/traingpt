export default function estimateDurationFromTitle(title: string | null | undefined): number {
  if (!title || typeof title !== 'string') return 0;

  try {
    const match = title.match(/(\d+)\s*min/i);
    return match ? parseInt(match[1], 10) : 0;
  } catch (err) {
    console.error('Failed to estimate duration from title:', title, err);
    return 0;
  }
}
