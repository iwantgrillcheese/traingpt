// /utils/calendar.ts
export function groupSessionsByDate(sessions: any[]) {
  return sessions.reduce((acc: Record<string, any[]>, session) => {
    const dateKey = session.date.slice(0, 10); // 'YYYY-MM-DD'
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(session);
    return acc;
  }, {});
}
