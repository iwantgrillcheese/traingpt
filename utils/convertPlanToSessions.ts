// utils/convertPlanToSessions.ts

export type Sport = 'swim' | 'bike' | 'run' | 'strength' | 'brick' | 'other';

const EmojiSportMap: Record<string, Sport> = {
  '🏊': 'swim',
  '🏊‍♂️': 'swim',
  '🏊‍♀️': 'swim',
  '🚴': 'bike',
  '🚴‍♂️': 'bike',
  '🚴‍♀️': 'bike',
  '🏃': 'run',
  '🏃‍♂️': 'run',
  '🏃‍♀️': 'run',
  '🏋️': 'strength',
  '🏋️‍♂️': 'strength',
  '🏋️‍♀️': 'strength',
};

function detectSport(text: string): Sport {
  const t = text.toLowerCase();
  if (t.includes('brick')) return 'brick';
  if (t.includes('swim') || t.includes('css') || t.includes('m ')) return 'swim';
  if (t.includes('bike') || t.includes('ride') || t.includes('ftp')) return 'bike';
  if (t.includes('run') || t.includes('mile') || t.includes('tempo')) return 'run';
  if (t.includes('strength') || t.includes('gym') || t.includes('core')) return 'strength';
  return 'other';
}

function parseStringItem(str: string) {
  // Strip leading emoji(s)
  const emojiMatch = str.match(/^\p{Extended_Pictographic}[\u200d\ufe0f\p{Extended_Pictographic}]*/u);
  const emoji = emojiMatch ? emojiMatch[0] : '';
  const withoutEmoji = str.slice(emoji.length).trim();

  // Split on em dash / hyphen dash
  let parts = withoutEmoji.split(/\s*[—-]\s*/g);
  // Drop trailing "Details" placeholder
  if (parts.length && /^details$/i.test(parts[parts.length - 1].trim())) {
    parts = parts.slice(0, -1);
  }

  const sport =
    (emoji && EmojiSportMap[emoji]) || detectSport(withoutEmoji);

  const title = parts.slice(0, 2).join(' — ').trim() || withoutEmoji;
  const details = parts.slice(2).join(' — ').trim() || null;

  return { sport, title, details, raw: str };
}

export type SessionRow = {
  user_id: string;
  plan_id: string;
  date: string;          // yyyy-mm-dd
  sport: Sport;
  title: string;
  details: string | null;
  raw: any | null;
  status: string;
  strava_id: string | null;
  structured_workout: any | null;
};

export function convertPlanToSessions(
  userId: string,
  planId: string,
  planJson: any
): SessionRow[] {
  const rows: SessionRow[] = [];

  for (const week of planJson.weeks) {
    for (const [date, items] of Object.entries<any>(week.days)) {
      for (const item of items as any[]) {
        if (typeof item === 'string') {
          const parsed = parseStringItem(item);
          rows.push({
            user_id: userId,
            plan_id: planId,
            date,
            sport: parsed.sport,
            title: parsed.title,
            details: parsed.details,
            raw: item,
            status: 'planned',
            strava_id: null,
            structured_workout: null,
          });
        } else {
          // Fallback if GPT ever emits objects
          rows.push({
            user_id: userId,
            plan_id: planId,
            date,
            sport: detectSport(JSON.stringify(item)),
            title: item.title ?? 'Session',
            details: item.details ?? null,
            raw: item,
            status: 'planned',
            strava_id: null,
            structured_workout: null,
          });
        }
      }
    }
  }

  return rows;
}
