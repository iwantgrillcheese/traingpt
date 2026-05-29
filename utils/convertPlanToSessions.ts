// utils/convertPlanToSessions.ts
import { addDays, formatISO, isValid, parseISO } from 'date-fns';

/**
 * DB-backed sport values only.
 * A brick is not a sport in the sessions table. It is modeled as bike + run
 * sessions on the same date.
 */
export type Sport = 'swim' | 'bike' | 'run' | 'strength' | 'other';

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

type ParsedSession = {
  sport: Sport | 'brick';
  title: string;
  details: string | null;
  raw: any;
};

function cleanTitle(value: unknown): string {
  return String(value ?? '')
    .replace(/^\s*[\p{Extended_Pictographic}\u200d\ufe0f]+\s*/u, '')
    .replace(/^[\s—–\-:•*]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isRestLike(text: string): boolean {
  const t = text.toLowerCase();
  return /\b(rest day|day off|off day|complete rest|recovery day)\b/.test(t);
}

function detectSport(text: string): Sport | 'brick' {
  const t = text.toLowerCase();

  const mentionsBike = /\b(bike|ride|cycling|ftp)\b/.test(t);
  const mentionsRun = /\b(run|running|jog|tempo|threshold|interval|off the bike)\b/.test(t);

  // Brick is a workout structure, not a DB sport.
  // If a single generated item describes the full bike + run workout, split it later.
  if (/\bbrick\b/.test(t) && mentionsBike && mentionsRun) return 'brick';
  if (/\bbike\s*\+\s*run\b/.test(t)) return 'brick';

  // If the generated item is already one side of a brick, keep the actual sport.
  if (/\bbrick\s+run\b/.test(t) || /\brun\s+off\s+the\s+bike\b/.test(t)) return 'run';
  if (/\bbrick\s+bike\b/.test(t)) return 'bike';

  if (t.includes('swim') || t.includes('css') || t.includes('pool')) return 'swim';
  if (mentionsBike) return 'bike';
  if (mentionsRun) return 'run';
  if (t.includes('strength') || t.includes('gym') || t.includes('core') || t.includes('mobility')) return 'strength';
  if (/\brace day\b|🏁/.test(t)) return 'other';
  return 'other';
}

function parseStringItem(str: string): ParsedSession | null {
  if (!str || !str.trim()) return null;
  if (isRestLike(str)) return null;

  // Strip leading emoji(s)
  const emojiMatch = str.match(
    /^\p{Extended_Pictographic}[\u200d\ufe0f\p{Extended_Pictographic}]*/u
  );
  const emoji = emojiMatch ? emojiMatch[0] : '';
  const withoutEmoji = str.slice(emoji.length).trim();

  /**
   * IMPORTANT:
   * We only split on em dash/en dash separators used by the plan format (— or –),
   * NOT hyphen-minus (-), because ranges like "145-185 watts" must be preserved.
   */
  let parts = withoutEmoji
    .split(/\s*[—–]\s*/g)
    .map((p) => p.trim())
    .filter(Boolean);

  // Drop trailing "Details" placeholder
  if (parts.length && /^details$/i.test(parts[parts.length - 1].trim())) {
    parts = parts.slice(0, -1);
  }

  const sport = (emoji && EmojiSportMap[emoji]) || detectSport(withoutEmoji);
  const title = cleanTitle(parts.join(' — ').trim() || withoutEmoji || str);
  const details = parts.length >= 3 ? parts.slice(2).join(' — ').trim() : null;

  if (!title) return null;
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

function safeWeekDays(value: unknown): Record<string, any[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value).map(([key, items]) => [
      String(key),
      Array.isArray(items) ? items.filter((item) => typeof item === 'string' || (!!item && typeof item === 'object')) : [],
    ])
  );
}

function buildRow({
  userId,
  planId,
  date,
  sport,
  title,
  details,
  raw,
}: {
  userId: string;
  planId: string;
  date: string;
  sport: Sport;
  title: string;
  details: string | null;
  raw: any;
}): SessionRow {
  const cleanedTitle = cleanTitle(title) || 'Session';
  return {
    user_id: userId,
    plan_id: planId,
    date,
    sport,
    title: cleanedTitle,
    session_title: cleanedTitle,
    details,
    raw,
    status: 'planned',
    strava_id: null,
    structured_workout: null,
  };
}

function extractBrickDurations(text: string): { bikeTitle: string; runTitle: string } {
  const lower = text.toLowerCase();

  const bikeDuration =
    lower.match(/bike[^0-9]*(\d+(?:\.\d+)?\s*(?:h|hr|hrs|hour|hours|min|mins|minutes))/i)?.[1] ??
    lower.match(/(\d+(?:\.\d+)?\s*(?:h|hr|hrs|hour|hours|min|mins|minutes))[^+]*(?:bike|ride)/i)?.[1] ??
    null;

  const runDuration =
    lower.match(/run[^0-9]*(\d+(?:\.\d+)?\s*(?:h|hr|hrs|hour|hours|min|mins|minutes))/i)?.[1] ??
    lower.match(/(\d+(?:\.\d+)?\s*(?:h|hr|hrs|hour|hours|min|mins|minutes))[^+]*(?:run|off the bike)/i)?.[1] ??
    null;

  return {
    bikeTitle: cleanTitle(`Brick Bike${bikeDuration ? ` — ${bikeDuration}` : ''}`),
    runTitle: cleanTitle(`Brick Run${runDuration ? ` — ${runDuration}` : ' — short easy transition run'}`),
  };
}

function rowsFromParsedSession({
  parsed,
  userId,
  planId,
  date,
}: {
  parsed: ParsedSession;
  userId: string;
  planId: string;
  date: string;
}): SessionRow[] {
  if (parsed.sport !== 'brick') {
    return [
      buildRow({
        userId,
        planId,
        date,
        sport: parsed.sport,
        title: parsed.title,
        details: parsed.details,
        raw: parsed.raw,
      }),
    ];
  }

  const text = typeof parsed.raw === 'string' ? parsed.raw : JSON.stringify(parsed.raw ?? {});
  const lower = text.toLowerCase();

  // If the item was misclassified but only contains one sport, preserve that sport.
  if (/\brun\b/.test(lower) && !/\b(bike|ride|cycling)\b/.test(lower)) {
    return [buildRow({ userId, planId, date, sport: 'run', title: cleanTitle(parsed.title), details: parsed.details, raw: parsed.raw })];
  }

  if (/\b(bike|ride|cycling)\b/.test(lower) && !/\brun\b/.test(lower)) {
    return [buildRow({ userId, planId, date, sport: 'bike', title: cleanTitle(parsed.title), details: parsed.details, raw: parsed.raw })];
  }

  const { bikeTitle, runTitle } = extractBrickDurations(text);
  const sharedDetails = parsed.details ?? 'Part of brick workout.';

  return [
    buildRow({ userId, planId, date, sport: 'bike', title: bikeTitle, details: sharedDetails, raw: parsed.raw }),
    buildRow({ userId, planId, date, sport: 'run', title: runTitle, details: sharedDetails, raw: parsed.raw }),
  ];
}

function parseObjectItem(item: any): ParsedSession | null {
  if (!item || typeof item !== 'object') return null;
  const title = cleanTitle(item?.title ?? item?.session_title ?? item?.name ?? 'Session');
  const details = typeof item?.details === 'string' ? item.details : typeof item?.description === 'string' ? item.description : null;
  const sportText = [item?.sport, title, details].filter(Boolean).join(' ');

  if (isRestLike(sportText)) return null;

  return {
    sport: detectSport(sportText),
    title,
    details,
    raw: item,
  };
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
  const weeks = Array.isArray(planJson?.weeks) ? planJson.weeks : [];

  for (const week of weeks) {
    if (!week || typeof week !== 'object') {
      console.error('[convertPlanToSessions] skipping malformed week object', { week });
      continue;
    }

    const canonical = buildCanonicalWeekDates(String(week.startDate ?? ''));
    if (canonical.length !== 7) {
      console.error('[convertPlanToSessions] skipping week with invalid startDate', {
        label: week?.label,
        startDate: week?.startDate,
      });
      continue;
    }

    const canonicalSet = new Set(canonical);
    const mapped: Record<string, any[]> = Object.fromEntries(canonical.map((d) => [d, []]));
    const extras: Array<{ key: string; items: any[] }> = [];

    const entries = Object.entries<any[]>(safeWeekDays(week.days));
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

    // Emit rows using canonical dates only.
    for (const date of canonical) {
      const items = mapped[date] ?? [];
      for (const item of items) {
        const parsed = typeof item === 'string' ? parseStringItem(item) : parseObjectItem(item);
        if (!parsed) continue;
        rows.push(...rowsFromParsedSession({ parsed, userId, planId, date }));
      }
    }
  }

  return rows;
}
