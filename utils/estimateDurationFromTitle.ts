export default function estimateDurationFromTitle(title: string | null | undefined): number {
  if (!title || typeof title !== 'string') return 0;

  try {
    // Extract the first instance of something like "90min" or "90 min"
    const match = title.match(/(\d{2,3})\s*min/i);
    if (match) return parseInt(match[1], 10);
  } catch (err) {
    console.error('Failed to estimate duration from title:', title, err);
  }

  return 0; // fallback if no match or error
}
