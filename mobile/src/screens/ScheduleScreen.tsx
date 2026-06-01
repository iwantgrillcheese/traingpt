import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, spacing } from '../design/theme';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import type { CompletedSessionRow, SessionRow, StravaActivityRow } from '../types';
import { SessionCard } from '../components/SessionCard';
import { SessionDetailSheet } from '../components/SessionDetailSheet';
import { currentWeekStats, formatDay, parseDate } from '../utils/training';
import { getActiveWeekReferenceDate, getWeeklyPointStats } from '../utils/sessionPoints';

function groupByWeek(sessions: SessionRow[]) {
  const weeks = new Map<string, { label: string; range: string; days: Map<string, SessionRow[]> }>();

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
    const label = `Week of ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(start)}`;
    const range = `${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(start)} – ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(end)}`;

    if (!weeks.has(weekKey)) weeks.set(weekKey, { label, range, days: new Map() });
    const week = weeks.get(weekKey)!;
    const existing = week.days.get(session.date) ?? [];
    existing.push(session);
    week.days.set(session.date, existing);
  });

  return Array.from(weeks.entries()).map(([key, week], index) => ({
    key,
    index,
    label: `Week ${index + 1}`,
    range: week.range,
    days: Array.from(week.days.entries()).sort(([a], [b]) => parseDate(a).getTime() - parseDate(b).getTime()),
  }));
}

export function ScheduleScreen() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [completed, setCompleted] = useState<CompletedSessionRow[]>([]);
  const [stravaActivities, setStravaActivities] = useState<StravaActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionRow | null>(null);

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

  const weeks = useMemo(() => groupByWeek(sessions), [sessions]);
  const stats = useMemo(() => currentWeekStats(sessions, completed), [sessions, completed]);
  const activeWeekDate = useMemo(() => getActiveWeekReferenceDate(sessions), [sessions]);
  const pointStats = useMemo(() => getWeeklyPointStats(sessions, completed, activeWeekDate), [sessions, completed, activeWeekDate]);

  if (loading) return <View style={styles.center}><ActivityIndicator /></View>;

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Training calendar</Text>
          <Text style={styles.title}>Schedule</Text>
          <Text style={styles.subtitle}>Your full plan, grouped by week. Tap any session to view details, mark it done, or bank points.</Text>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryCol}>
            <Text style={styles.summaryValue}>{pointStats.earned}/{pointStats.available || 0}</Text>
            <Text style={styles.summaryLabel}>Active week points</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryCol}>
            <Text style={styles.summaryValue}>{stats.done}/{stats.planned || 0}</Text>
            <Text style={styles.summaryLabel}>This week complete</Text>
          </View>
        </View>

        {weeks.length ? weeks.map((week) => (
          <View key={week.key} style={styles.weekSection}>
            <View style={styles.weekHeader}>
              <View>
                <Text style={styles.weekLabel}>{week.label}</Text>
                <Text style={styles.weekRange}>{week.range}</Text>
              </View>
              <Text style={styles.weekCount}>{week.days.reduce((sum, [, items]) => sum + items.length, 0)} sessions</Text>
            </View>

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
        )) : (
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
  header: { marginBottom: 20 },
  kicker: { color: colors.faint, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.8 },
  title: { marginTop: 12, color: colors.ink, fontSize: 46, lineHeight: 47, fontWeight: '900', letterSpacing: -2.4 },
  subtitle: { marginTop: 12, color: colors.inkSoft, fontSize: 16, lineHeight: 24, fontWeight: '500' },
  summaryCard: { flexDirection: 'row', backgroundColor: colors.ink, borderRadius: radius.xl, paddingVertical: 18, paddingHorizontal: 6, ...shadow.hero },
  summaryCol: { flex: 1, alignItems: 'center', paddingHorizontal: 12 },
  summaryDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.16)' },
  summaryValue: { color: colors.surface, fontSize: 25, fontWeight: '900', letterSpacing: -0.9 },
  summaryLabel: { marginTop: 6, color: '#d4d4d8', fontSize: 12, lineHeight: 17, fontWeight: '800', textAlign: 'center' },
  weekSection: { marginTop: 26 },
  weekHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12 },
  weekLabel: { color: colors.ink, fontSize: 24, fontWeight: '900', letterSpacing: -1 },
  weekRange: { marginTop: 3, color: colors.muted, fontSize: 13, fontWeight: '750' },
  weekCount: { color: colors.success, fontSize: 12, fontWeight: '900' },
  dayGroup: { marginBottom: 14 },
  dayLabel: { marginBottom: 8, color: colors.faint, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2 },
  emptyCard: { marginTop: 20, backgroundColor: colors.surface, borderRadius: radius.xl, borderColor: colors.border, borderWidth: 1, padding: 20, ...shadow.card },
  emptyTitle: { color: colors.ink, fontSize: 23, fontWeight: '900', letterSpacing: -0.8 },
  emptyText: { marginTop: 8, color: colors.muted, fontSize: 14, lineHeight: 22 },
});
