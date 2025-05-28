// app/schedule/utils/generateCoachQuestion.ts

export function generateCoachQuestion(dateLabel: string, session: string): string {
  const lower = session.toLowerCase();

  if (lower.includes('swim')) {
    return `Hey, can you give me a structured swim workout for my session on ${dateLabel}? It's listed as "${session}".`;
  }

  if (lower.includes('bike')) {
    return `For my bike session on ${dateLabel} ("${session}"), what power or intensity should I aim for?`;
  }

  if (lower.includes('run')) {
    return `Can you help me pace my run on ${dateLabel}? The plan says "${session}". Just want to make sure I'm doing it right.`;
  }

  return `Can you explain the workout on ${dateLabel}? It says "${session}" and I’d like a bit more detail.`;
}
