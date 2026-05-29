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


function stripInstructionalNoise(value: string): string {
  return cleanTitle(value)
    .replace(/\b(?:around|about|approximately)\s+/gi, '')
    .replace(/\([^)]*(?:min|mins|minutes|mi|mile|miles|km|ftp|watts?|pace|css|z2|zone|threshold)[^)]*\)/gi, '')
    .replace(/\b\d+(?:\.\d+)?\s*(?:min|mins|minutes|miles?|mi|km|m|yd|yards?|h|hr|hrs|hour|hours)\b/gi, '')
    .replace(/\b\d+\s*[x×]\s*\d+[^,;)]*/gi, '')
    .replace(/\b\d{1,2}:\d{2}\s*(?:\/\s*(?:mi|mile|km|100m))?\b/gi, '')
    .replace(/\b\d+\s*-\s*\d+\s*(?:%|watts?|ftp|bpm)?\b/gi, '')
    .replace(/\b(?:at|with|including|focused on|focusing on)\b.*$/gi, '')
    .replace(/[()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactStrengthTitle(text: string): string {
  const t = text.toLowerCase();
  if (/\bcore\b/.test(t) && /\blower\b/.test(t)) return 'Strength Lower + Core';
  if (/\bupper\b/.test(t) && /\bcore\b/.test(t)) return 'Strength Upper + Core';
  if (/\blower\b/.test(t)) return 'Strength Lower';
  if (/\bupper\b/.test(t)) return 'Strength Upper';
  if (/\bcore\b/.test(t)) return 'Strength Core';
  if (/\bfull body\b|\bfull-body\b|\bcircuit\b/.test(t)) return 'Strength Full Body';
  if (/\bmobility\b|\bactivation\b/.test(t)) return 'Mobility';
  return 'Strength';
}

function deriveCalendarTitle(sport: Sport | 'brick', source: string): string {
  const cleaned = stripInstructionalNoise(source);
  const t = `${source} ${cleaned}`.toLowerCase();

  if (sport === 'brick') return 'Brick Workout';

  if (sport === 'strength') return compactStrengthTitle(source);

  if (sport === 'swim') {
    if (/\btechnique\b|\bdrill\b|\bstroke\b|\bform\b/.test(t)) return 'Swim Technique';
    if (/\bthreshold\b|\bcss\b|\binterval\b|\btempo\b/.test(t)) return 'Swim Threshold';
    if (/\bopen water\b/.test(t)) return 'Open Water Swim';
    if (/\bendurance\b|\bbase\b|\bsteady\b|\baerobic\b|\bmoderate\b/.test(t)) return 'Swim Endurance';
    if (/\beasy\b|\brecovery\b/.test(t)) return 'Swim Easy';
    return cleaned && cleaned.length <= 24 && /^swim/i.test(cleaned) ? cleaned : 'Swim';
  }

  if (sport === 'bike') {
    if (/\bbrick\b/.test(t)) return 'Brick Bike';
    if (/\blong\b/.test(t)) return 'Long Ride';
    if (/\bthreshold\b|\bftp\b|\binterval\b|\b90\s*-?\s*95\b|\bvo2\b/.test(t)) return 'Bike Threshold';
    if (/\btempo\b|\bsweet spot\b/.test(t)) return 'Bike Tempo';
    if (/\bendurance\b|\bbase\b|\bz2\b|\bzone 2\b|\baerobic\b|\bsteady\b/.test(t)) return 'Bike Endurance';
    if (/\beasy\b|\brecovery\b/.test(t)) return 'Bike Easy';
    return cleaned && cleaned.length <= 24 && /bike|ride/i.test(cleaned) ? cleaned : 'Bike';
  }

  if (sport === 'run') {
    if (/\bbrick\b|\boff the bike\b|\btransition\b/.test(t)) return 'Brick Run';
    if (/\blong\b/.test(t)) return 'Long Run';
    if (/\bthreshold\b/.test(t)) return 'Run Threshold';
    if (/\binterval\b|\brepeats\b|\b5k\b|\b10k\b/.test(t)) return 'Run Intervals';
    if (/\btempo\b|\brace pace\b/.test(t)) return 'Run Tempo';
    if (/\beasy\b|\brecovery\b|\bz2\b|\bzone 2\b|\baerobic\b/.test(t)) return 'Run Easy';
    return cleaned && cleaned.length <= 24 && /^run/i.test(cleaned) ? cleaned : 'Run';
  }

  return cleaned || 'Session';
}



function isDetailsPlaceholder(value: unknown): boolean {
  const raw = String(value ?? '').trim();
  const text = raw.replace(/\s+/g, ' ').toLowerCase();

  if (!text) return true;

  const placeholders = new Set([
    'details',
    'detail',
    'details details',
    'details details details',
    'tbd',
    'n/a',
    'na',
    'none',
    'null',
    'undefined',
    'workout details',
    'session details',
  ]);

  if (placeholders.has(text)) return true;

  // Examples: "Run Threshold — Details", "Swim Endurance: Details".
  if (/^[a-z0-9\s+&/()]+[-—–:]\s*(details?|session details|workout details)$/i.test(raw)) {
    return true;
  }

  return false;
}

function cleanDetails(value: unknown): string | null {
  const text = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return null;

  const lowered = text.toLowerCase();

  const junkValues = new Set([
    'details',
    'details details',
    'details details details',
    'tbd',
    'n/a',
    'none',
    'null',
    'undefined',
  ]);

  if (junkValues.has(lowered)) return null;

  // Avoid storing fake placeholders like "Run Threshold — Details".
  if (/^[a-z\s]+[-—–:]\s*details$/i.test(text)) return null;

  return text;
}

function joinDetails(parts: string[], fallback: string, title: string): string | null {
  const cleanedParts = parts.map(cleanDetails).filter((part): part is string => Boolean(part));
  const detailText = cleanedParts.join(' — ').trim();
  const cleanedFallback = cleanDetails(fallback);

  if (detailText && detailText.toLowerCase() !== title.toLowerCase()) return detailText;
  if (cleanedFallback && cleanedFallback.toLowerCase() !== title.toLowerCase()) return cleanedFallback;
  return null;
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
  if (isRestLike(str) || isDetailsPlaceholder(str)) return null;

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

  // Drop trailing placeholder detail tokens. If the whole item is just placeholder text, skip it.
  while (parts.length && isDetailsPlaceholder(parts[parts.length - 1])) {
    parts = parts.slice(0, -1);
  }
  if (!parts.length || isDetailsPlaceholder(parts[0])) return null;

  const sport = (emoji && EmojiSportMap[emoji]) || detectSport(withoutEmoji);
  const hasExplicitSportPrefix = parts.length > 1 && /^(swim|bike|ride|run|strength|gym|brick)$/i.test(parts[0]);
  const titleSource = hasExplicitSportPrefix ? parts[1] : (parts[0] || withoutEmoji || str);
  const title = deriveCalendarTitle(sport, [parts[0], titleSource, withoutEmoji].filter(Boolean).join(' '));
  const detailParts = hasExplicitSportPrefix ? parts.slice(2) : parts.slice(1);
  const details = joinDetails(detailParts, withoutEmoji, title);

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
    bikeTitle: 'Brick Bike',
    runTitle: 'Brick Run',
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
  const sharedDetails = parsed.details ?? cleanDetails(text) ?? 'Part of brick workout.';

  return [
    buildRow({ userId, planId, date, sport: 'bike', title: bikeTitle, details: sharedDetails, raw: parsed.raw }),
    buildRow({ userId, planId, date, sport: 'run', title: runTitle, details: sharedDetails, raw: parsed.raw }),
  ];
}

function parseObjectItem(item: any): ParsedSession | null {
  if (!item || typeof item !== 'object') return null;
  const originalTitle = cleanTitle(item?.title ?? item?.session_title ?? item?.name ?? 'Session');
  const originalDetails = cleanDetails(
    typeof item?.details === 'string'
      ? item.details
      : typeof item?.description === 'string'
        ? item.description
        : typeof item?.detail === 'string'
          ? item.detail
          : null
  );
  const sportText = [item?.sport, originalTitle, originalDetails].filter(Boolean).join(' ');

  if (isRestLike(sportText) || isDetailsPlaceholder(originalTitle)) return null;

  const sport = detectSport(sportText);
  const title = deriveCalendarTitle(sport, sportText);
  const details = joinDetails([], [originalDetails, originalTitle].filter(Boolean).join(' — '), title);

  return {
    sport,
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
