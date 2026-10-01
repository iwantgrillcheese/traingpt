export type CompletionRecord = {
  session_id?: string | null;
  completed_at?: string | null;
  date?: string | null;
  session_date?: string | null;
  session_title?: string | null;
  title?: string | null;
  status?: string | null;
};
export type CompletableSession = { id?: string | null; date?: string | null; title?: string | null; status?: string | null; stravaActivity?: unknown };

/** Linked records never fall back to title matching against a different session. */
export function completionMatches(row: CompletionRecord, session: CompletableSession): boolean {
  if (row.session_id) return !!session.id && row.session_id === session.id;
  return (row.date ?? row.session_date) === session.date
    && String(row.session_title ?? row.title ?? '').trim().toLowerCase() === String(session.title ?? '').trim().toLowerCase();
}

export function findCompletion<T extends CompletionRecord>(rows: T[], session: CompletableSession): T | undefined {
  return rows.find(row => !!row.session_id && completionMatches(row, session))
    ?? rows.find(row => !row.session_id && completionMatches(row, session));
}

export function sessionIsComplete(session: CompletableSession, rows: CompletionRecord[]): boolean {
  if (session.stravaActivity) return true;
  const row = findCompletion(rows, session);
  return row ? (row.status ?? 'done') === 'done' : session.status === 'done';
}

export function completedEarly(session: CompletableSession, row?: CompletionRecord): boolean {
  if (!session.date || !row?.completed_at || (row.status ?? 'done') !== 'done') return false;
  const actual = new Date(row.completed_at);
  if (!Number.isFinite(actual.getTime())) return false;
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(actual) < session.date;
}
