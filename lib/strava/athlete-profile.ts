export type ProfileActivity = { sport_type: string | null; moving_time: number | null; start_date: string | null; start_date_local?: string | null };
export type BrickProfile = {
  id: string; name: string; tagline: string; traits: string[]; evidence: string[];
  hoursBySport: { bike: number; run: number; swim: number };
  windowDays: number; activityCount: number; confidence: 'low' | 'supported';
};
export function enduranceSport(value: string | null): 'bike' | 'run' | 'swim' | null {
  const sport = (value ?? '').toLowerCase();
  if (['bike', 'ride', 'virtualride', 'ebikeride', 'emountainbikeride', 'mountainbikeride', 'gravelride'].includes(sport)) return 'bike';
  if (['run', 'trailrun', 'virtualrun'].includes(sport)) return 'run';
  return sport === 'swim' ? 'swim' : null;
}
const archetypes = {
  builder: ['ENDURANCE BUILDER', 'Every session is another brick.', ['Building a baseline', 'Room to grow']],
  comeback: ['THE COMEBACK', 'Your next chapter is already moving.', ['Renewed momentum', 'Back in motion']],
  allrounder: ['THE ALL-ROUNDER', 'One engine. Every discipline.', ['Balanced training', 'Versatile']],
  weekend: ['THE WEEKEND WARRIOR', 'You make the big days count.', ['Weekend focus', 'Time well spent']],
  bigday: ['THE BIG DAY SPECIALIST', 'Built for the long way home.', ['Long-session focus', 'Endurance minded']],
  diesel: ['THE DIESEL', 'Steady miles. A powerful engine.', ['Bike led', 'Endurance minded']],
  engine: ['THE ENGINE', 'You keep the miles turning.', ['Run led', 'Repeatable rhythm']],
  grinder: ['THE GRINDER', 'Progress has a regular appointment.', ['Consistent', 'Week after week']],
} as const;
export function buildBrickProfile(rows: ProfileActivity[], now = Date.now()): BrickProfile {
  const day = 86400000;
  const hoursBySport = { bike: 0, run: 0, swim: 0 };
  const recent = rows.filter(row => {
    const age = now - Date.parse(row.start_date ?? '');
    return age >= 0 && age < 56 * day && enduranceSport(row.sport_type) && Number.isFinite(row.moving_time) && Number(row.moving_time) > 0 && Number(row.moving_time) <= 24 * 3600;
  });
  const weeks = new Set<number>(); const activeDays = new Set<string>();
  let total = 0, weekend = 0, long = 0, current = 0, previous = 0;
  for (const row of recent) {
    const hours = Number(row.moving_time) / 3600;
    const sport = enduranceSport(row.sport_type)!;
    hoursBySport[sport] += hours; total += hours;
    const age = now - Date.parse(row.start_date!);
    weeks.add(Math.floor(age / (7 * day)));
    const local = row.start_date_local || row.start_date!;
    activeDays.add(local.slice(0, 10));
    const weekday = new Date(local.slice(0, 10) + 'T12:00:00Z').getUTCDay();
    if (weekday === 0 || weekday === 6) weekend += hours;
    if (hours >= 2) long += hours;
    if (age < 28 * day) current += hours; else previous += hours;
  }
  const share = (sport: keyof typeof hoursBySport) => total ? hoursBySport[sport] / total : 0;
  let id: keyof typeof archetypes = 'builder';
  const supported = recent.length >= 8 && weeks.size >= 3;
  if (supported) {
    if (current >= 6 && previous < 2 && recent.filter(row => now - Date.parse(row.start_date!) < 28 * day).length >= 6) id = 'comeback';
    else if (share('bike') >= .2 && share('run') >= .2 && share('swim') >= .1 && Math.max(...Object.values(hoursBySport)) / total <= .65) id = 'allrounder';
    else if (weekend / total >= .65) id = 'weekend';
    else if (long / total >= .55) id = 'bigday';
    else if (share('bike') >= .65) id = 'diesel';
    else if (share('run') >= .65) id = 'engine';
    else if (weeks.size >= 6 && activeDays.size / 8 >= 3) id = 'grinder';
  }
  const [name, tagline, traits] = archetypes[id];
  const evidence = supported ? [
    `${weeks.size} of 8 weeks active`, `${(total / 8).toFixed(1)} hours per week`,
    id === 'weekend' ? `${Math.round(weekend / total * 100)}% of training on weekends` : id === 'bigday' ? `${Math.round(long / total * 100)}% of time in 2h+ sessions` : id === 'comeback' ? `${current.toFixed(1)}h in the last 4 weeks · ${previous.toFixed(1)}h in the prior 4` : `${recent.length} endurance sessions`,
  ] : [`${recent.length} sessions in the last 8 weeks`, 'More history will sharpen your profile'];
  return { id, name, tagline, traits: [...traits], evidence, hoursBySport, windowDays: 56, activityCount: recent.length, confidence: supported ? 'supported' : 'low' };
}
