// app/schedule/utils/generateCoachQuestion.ts

export function generateCoachQuestion(date: string, label: string): string {
  const session = label.toLowerCase();

  if (session.includes('swim') && session.includes('drills')) {
    return `Can you give me drill suggestions for my swim on ${date}?`;
  }

  if (session.includes('swim')) {
    return `Can you give me specific swim sets to follow for my ${label}?`;
  }

  if (session.includes('bike') && session.includes('ftp')) {
    return `What power zones should I hold during my ${label}?`;
  }

  if (session.includes('bike') && session.includes('interval')) {
    return `What interval structure do you recommend for my ${label}?`;
  }

  if (session.includes('bike') && session.includes('z2')) {
    return `What wattage range should I target during my Zone 2 ride on ${date}?`;
  }

  if (session.includes('run') && session.includes('threshold')) {
    return `What pace should I aim for during my threshold run on ${date}?`;
  }

  if (session.includes('run') && session.includes('brick')) {
    return `How should I pace and transition for my brick workout on ${date}?`;
  }

  if (session.includes('run') && session.includes('easy')) {
    return `Can you confirm what heart rate or pace I should target for my easy run on ${date}?`;
  }

  return `Can you give me more detail on my ${label} scheduled for ${date}?`;
}
