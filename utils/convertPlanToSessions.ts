// utils/convertPlanToSessions.ts
import { addDays, formatISO, isValid, parseISO } from 'date-fns';

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
  if (t.includes('swim') || t.includes('css')) return 'swim';
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

  const sport = (emoji && EmojiSportMap[emoji]) || detectSport(withoutEmoji);

  const title = parts.join(' ').trim() || withoutEmoji;
  const details = parts.slice(2).join(' — ').trim() || null;

  return { sport, title, details, raw: str };
}

export type SessionRow = {
  user_id: string;
  plan_id: string;
  date: string; // yyyy-mm-dd
  sport: Sport;
  title: string;
  session_title?: string; // keep for backward compatibility
  details: string | null;
  raw: any | null;
  status: string;
  strava_id: string | null;
  structured_workout: any | null;
};

function isoDate(d: Date) {
  return formatISO(d, { representation: 'date' });
}

function buildCanonicalWeekDates(weekStartISO: string): string[] {
  const start = parseISO(weekStartISO);
  if (!isValid(start)) return [];
  const out: string[] = [];
  for (let i = 0; i < 7; i++) out.push(isoDate(addDays(start, i)));
  return out;
}

/**
 * Converts a generated plan JSON blob into atomic session rows.
 *
 * IMPORTANT: We do NOT trust LLM-generated date keys inside `week.days`.
 * We always generate canonical Monday→Sunday dates from `week.startDate`,
 * then map day items onto those dates. This prevents invalid dates like
 * "2026-02-29" from ever reaching Postgres.
 */
export function convertPlanToSessions(userId: string, planId: string, planJson: any): SessionRow[] {
  const rows: SessionRow[] = [];

  for (const week of planJson?.weeks ?? []) {
    const canonical = buildCanonicalWeekDates(week.startDate);
    if (canonical.length !== 7) continue;

    const canonicalSet = new Set(canonical);
    const mapped: Record<string, any[]> = Object.fromEntries(canonical.map((d) => [d, []]));
    const extras: Array<{ key: string; items: any[] }> = [];

    const entries = Object.entries<any>(week.days ?? {});
    entries.sort(([a], [b]) => String(a).localeCompare(String(b)));

    for (const [key, items] of entries) {
      if (canonicalSet.has(String(key))) {
        mapped[String(key)] = Array.isArray(items) ? items : [];
      } else {
        extras.push({ key: String(key), items: Array.isArray(items) ? items : [] });
      }
    }

    // If the model produced invalid/missing keys (e.g. Feb 29),
    // fill empty canonical days with the "extras" in order.
    const emptyDays = canonical.filter((d) => (mapped[d]?.length ?? 0) === 0);
    for (let i = 0; i < Math.min(emptyDays.length, extras.length); i++) {
      mapped[emptyDays[i]] = extras[i].items;
    }

    // Emit rows using canonical dates only
    for (const date of canonical) {
      const items = mapped[date] ?? [];
      for (const item of items) {
        if (typeof item === 'string') {
          const parsed = parseStringItem(item);
          rows.push({
            user_id: userId,
            plan_id: planId,
            date,
            sport: parsed.sport,
            title: parsed.title,
            session_title: parsed.title, // keep both populated
            details: parsed.details,
            raw: item,
            status: 'planned',
            strava_id: null,
            structured_workout: null,
          });
        } else {
          const title = item?.title ?? 'Session';
          rows.push({
            user_id: userId,
            plan_id: planId,
            date,
            sport: detectSport(JSON.stringify(item)),
            title,
            session_title: title, // keep both populated
            details: item?.details ?? null,
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
