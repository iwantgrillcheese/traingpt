import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, spacing } from '../design/theme';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import type { CompletedSessionRow, SessionRow, StravaActivityRow } from '../types';
import { SessionCard } from '../components/SessionCard';
import { SessionDetailSheet } from '../components/SessionDetailSheet';
import { formatDay, parseDate } from '../utils/training';
import { completedKeySet, getActiveWeekReferenceDate, getTotalAvailablePoints, sessionCompletionKey } from '../utils/sessionPoints';

type WeekGroup = {
  key: string;
  index: number;
  label: string;
  range: string;
  days: [string, SessionRow[]][];
  points: number;
  completedCount: number;
  sessionCount: number;
};

function groupByWeek(sessions: SessionRow[], completed: CompletedSessionRow[]): WeekGroup[] {
  const done = completedKeySet(completed);
  const weeks = new Map<string, { range: string; days: Map<string, SessionRow[]> }>();

  sessions.forEach((session) => {
    const date = parseDate(session.date);
    const day = date.getDay();
    const offset = day === 0 ? -6 : 1 - day;
    const start = new Date(date);
    start.setDate(date.getDate() + offset);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    const weekKey = start.toISOString().slice(0, 10);
    const range = `${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(start)} – ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(end)}`;

    if (!weeks.has(weekKey)) weeks.set(weekKey, { range, days: new Map() });
    const week = weeks.get(weekKey)!;
    const existing = week.days.get(session.date) ?? [];
    existing.push(session);
    week.days.set(session.date, existing);
  });

  return Array.from(weeks.entries()).map(([key, week], index) => {
    const weekSessions = Array.from(week.days.values()).flat();
    return {
      key,
      index,
      label: `Training Week ${index + 1}`,
      range: week.range,
      days: Array.from(week.days.entries()).sort(([a], [b]) => parseDate(a).getTime() - parseDate(b).getTime()),
      points: getTotalAvailablePoints(weekSessions),
      completedCount: weekSessions.filter((session) => done.has(sessionCompletionKey(session.date, session.title))).length,
      sessionCount: weekSessions.length,
    };
  });
}

export function ScheduleScreen() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [completed, setCompleted] = useState<CompletedSessionRow[]>([]);
  const [stravaActivities, setStravaActivities] = useState<StravaActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionRow | null>(null);
  const [openWeeks, setOpenWeeks] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    if (!user?.id) return;
    const [{ data: sessionRows }, { data: completedRows }, { data: stravaRows }] = await Promise.all([
      supabase.from('sessions').select('id,user_id,plan_id,date,sport,title,duration,details,structured_workout').eq('user_id', user.id).order('date', { ascending: true }).limit(1000),
      supabase.from('completed_sessions').select('id,user_id,date,session_title,status').eq('user_id', user.id),
      supabase.from('strava_activities').select('id,user_id,strava_id,name,sport_type,start_date,start_date_local,moving_time,distance').eq('user_id', user.id).order('start_date', { ascending: false }).limit(150),
    ]);
    setSessions((sessionRows ?? []) as SessionRow[]);
    setCompleted((completedRows ?? []) as CompletedSessionRow[]);
    setStravaActivities((stravaRows ?? []) as StravaActivityRow[]);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const updateSessionLocally = (updated: SessionRow) => {
    setSessions((prev) => prev.map((session) => (session.id === updated.id ? { ...session, ...updated } : session)));
    setSelectedSession((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev));
  };

  const markDoneFor = async (session: SessionRow) => {
    if (!user?.id || !session.title) return;
    const existing = completed.filter((row) => row.date !== session.date || row.session_title !== session.title);
    const next = [...existing, { user_id: user.id, date: session.date, session_title: String(session.title), status: 'done' }];
    setCompleted(next);

    await supabase.from('completed_sessions').delete().eq('user_id', user.id).eq('date', session.date).eq('session_title', session.title);
    await supabase.from('completed_sessions').insert({ user_id: user.id, date: session.date, session_title: session.title, status: 'done' });
  };

  const skipSession = async (session: SessionRow) => {
    if (!user?.id || !session.title) return;
    const existing = completed.filter((row) => row.date !== session.date || row.session_title !== session.title);
    const next = [...existing, { user_id: user.id, date: session.date, session_title: String(session.title), status: 'skipped' }];
    setCompleted(next);

    await supabase.from('completed_sessions').delete().eq('user_id', user.id).eq('date', session.date).eq('session_title', session.title);
    await supabase.from('completed_sessions').insert({ user_id: user.id, date: session.date, session_title: session.title, status: 'skipped' });
  };

  const weeks = useMemo(() => groupByWeek(sessions, completed), [sessions, completed]);
  const activeWeekDate = useMemo(() => getActiveWeekReferenceDate(sessions), [sessions]);
  const activeWeekKey = useMemo(() => {
    const start = new Date(activeWeekDate);
    const day = start.getDay();
    const offset = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + offset);
    start.setHours(0, 0, 0, 0);
    return start.toISOString().slice(0, 10);
  }, [activeWeekDate]);

  useEffect(() => {
    if (!weeks.length) return;
    setOpenWeeks((prev) => {
      if (Object.keys(prev).length) return prev;
      const firstOpen = weeks.find((week) => week.key === activeWeekKey)?.key ?? weeks[0].key;
      return { [firstOpen]: true };
    });
  }, [activeWeekKey, weeks]);

  const toggleWeek = (weekKey: string) => {
    setOpenWeeks((prev) => ({ ...prev, [weekKey]: !prev[weekKey] }));
  };

  if (loading) return <View style={styles.center}><ActivityIndicator /></View>;

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Training calendar</Text>
          <Text style={styles.title}>Schedule</Text>
          <Text style={styles.subtitle}>Open each training week to see the work. Tap any session to view details or bank points.</Text>
        </View>

        {weeks.length ? weeks.map((week) => {
          const isOpen = Boolean(openWeeks[week.key]);
          const isActive = week.key === activeWeekKey;
          return (
            <View key={week.key} style={[styles.weekCard, isActive && styles.weekCardActive]}>
              <Pressable onPress={() => toggleWeek(week.key)} style={({ pressed }) => [styles.weekHeader, pressed && styles.pressed]}>
                <View style={{ flex: 1 }}>
                  <View style={styles.weekTitleRow}>
                    <Text style={styles.weekLabel}>{week.label}</Text>
                    {isActive ? <Text style={styles.activePill}>Active</Text> : null}
                  </View>
                  <Text style={styles.weekRange}>{week.range}</Text>
                  <Text style={styles.weekMeta}>{week.completedCount}/{week.sessionCount} complete · {week.points} pts available</Text>
                </View>
                <Text style={styles.chevron}>{isOpen ? '⌄' : '›'}</Text>
              </Pressable>

              {isOpen ? (
                <View style={styles.weekBody}>
                  {week.days.map(([date, items]) => (
                    <View key={date} style={styles.dayGroup}>
                      <Text style={styles.dayLabel}>{formatDay(date)}</Text>
                      {items.map((session) => (
                        <SessionCard
                          key={session.id}
                          session={session}
                          completed={completed}
                          stravaActivities={stravaActivities}
                          onPress={() => setSelectedSession(session)}
                        />
                      ))}
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        }) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No sessions yet.</Text>
            <Text style={styles.emptyText}>Create a plan and your schedule will appear here.</Text>
          </View>
        )}
      </ScrollView>

      <SessionDetailSheet
        session={selectedSession}
        completed={completed}
        open={Boolean(selectedSession)}
        onClose={() => setSelectedSession(null)}
        onMarkDone={markDoneFor}
        onSkip={skipSession}
        onSessionUpdated={updateSessionLocally}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.pageX, paddingTop: 62, paddingBottom: 132 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  header: { marginBottom: 18 },
  kicker: { color: colors.faint, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.8 },
  title: { marginTop: 12, color: colors.ink, fontSize: 46, lineHeight: 47, fontWeight: '900', letterSpacing: -2.4 },
  subtitle: { marginTop: 12, color: colors.inkSoft, fontSize: 16, lineHeight: 24, fontWeight: '500' },
  weekCard: { marginTop: 12, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadow.card },
  weekCardActive: { borderColor: '#86efac', backgroundColor: '#fbfffb' },
  weekHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  weekTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  weekLabel: { color: colors.ink, fontSize: 22, fontWeight: '900', letterSpacing: -0.8 },
  activePill: { overflow: 'hidden', borderRadius: 999, backgroundColor: colors.successSoft, color: colors.success, paddingHorizontal: 8, paddingVertical: 4, fontSize: 10, fontWeight: '900' },
  weekRange: { marginTop: 4, color: colors.muted, fontSize: 13, fontWeight: '800' },
  weekMeta: { marginTop: 8, color: colors.inkSoft, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  chevron: { color: colors.ink, fontSize: 30, lineHeight: 32, fontWeight: '600' },
  weekBody: { paddingHorizontal: 14, paddingBottom: 12, borderTopWidth: 1, borderTopColor: colors.border },
  dayGroup: { marginTop: 14 },
  dayLabel: { marginBottom: 8, color: colors.faint, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2 },
  pressed: { opacity: 0.72 },
  emptyCard: { marginTop: 20, backgroundColor: colors.surface, borderRadius: radius.xl, borderColor: colors.border, borderWidth: 1, padding: 20, ...shadow.card },
  emptyTitle: { color: colors.ink, fontSize: 23, fontWeight: '900', letterSpacing: -0.8 },
  emptyText: { marginTop: 8, color: colors.muted, fontSize: 14, lineHeight: 22 },
});
