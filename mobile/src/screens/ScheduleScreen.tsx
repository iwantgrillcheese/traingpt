import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, spacing } from '../design/theme';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import type { CompletedSessionRow, SessionRow } from '../types';
import { SessionCard } from '../components/SessionCard';
import { SessionDetailSheet } from '../components/SessionDetailSheet';
import { cleanTitle, currentWeekStats, formatDay, formatMinutes, getCompletionStatus, getNextSession, normalizeSport, parseDate } from '../utils/training';
import { getSessionPoints, getWeeklyPointStats } from '../utils/sessionPoints';

function groupByDate(sessions: SessionRow[]) {
  const groups = new Map<string, SessionRow[]>();
  sessions.forEach((session) => {
    const existing = groups.get(session.date) ?? [];
    existing.push(session);
    groups.set(session.date, existing);
  });
  return Array.from(groups.entries()).sort(([a], [b]) => parseDate(a).getTime() - parseDate(b).getTime());
}

function weekDates() {
  const now = new Date();
  const day = now.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  const start = new Date(now);
  start.setDate(now.getDate() + offset);
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function ScheduleScreen() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [completed, setCompleted] = useState<CompletedSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionRow | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const [{ data: sessionRows }, { data: completedRows }] = await Promise.all([
      supabase.from('sessions').select('id,user_id,plan_id,date,sport,title,duration,details,structured_workout').eq('user_id', user.id).order('date', { ascending: true }).limit(500),
      supabase.from('completed_sessions').select('id,user_id,date,session_title,status').eq('user_id', user.id),
    ]);
    setSessions((sessionRows ?? []) as SessionRow[]);
    setCompleted((completedRows ?? []) as CompletedSessionRow[]);
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

  const groups = useMemo(() => groupByDate(sessions), [sessions]);
  const stats = useMemo(() => currentWeekStats(sessions, completed), [sessions, completed]);
  const pointStats = useMemo(() => getWeeklyPointStats(sessions, completed), [sessions, completed]);
  const nextSession = useMemo(() => getNextSession(sessions), [sessions]);
  const nextPoints = nextSession ? getSessionPoints(nextSession) : 0;
  const dates = useMemo(() => weekDates(), []);
  const todayKey = dateKey(new Date());

  if (loading) return <View style={styles.center}><ActivityIndicator /></View>;

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>TrainGPT</Text>
            <Text style={styles.title}>Schedule</Text>
            <Text style={styles.month}>{new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date())}</Text>
          </View>
          <View style={styles.headerActions}>
            <Text style={styles.todayButton}>Today</Text>
            <Text style={styles.arrowButton}>‹</Text>
            <Text style={styles.arrowButton}>›</Text>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryCol}><Text style={styles.summaryValue}>{pointStats.earned}/{pointStats.available || 0}</Text><Text style={styles.summaryLabel}>Points</Text></View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryCol}><Text style={styles.summaryValue}>{stats.done}/{stats.planned || 0}</Text><Text style={styles.summaryLabel}>Complete</Text></View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryCol}><Text style={styles.summaryValue}>{stats.planned ? `${stats.adherence}%` : '—'}</Text><Text style={styles.summaryLabel}>Adherence</Text></View>
        </View>

        <View style={styles.weekStrip}>
          {dates.map((date) => {
            const key = dateKey(date);
            const hasSession = sessions.some((session) => session.date === key);
            const isToday = key === todayKey;
            return (
              <View key={key} style={styles.dayItem}>
                <Text style={styles.dayLetter}>{new Intl.DateTimeFormat('en-US', { weekday: 'narrow' }).format(date)}</Text>
                <Text style={[styles.dayNumber, isToday && styles.dayNumberActive]}>{date.getDate()}</Text>
                <View style={[styles.dayDot, hasSession && styles.dayDotActive]} />
              </View>
            );
          })}
        </View>

        {nextSession ? (
          <Pressable onPress={() => setSelectedSession(nextSession)} style={({ pressed }) => [styles.keyCard, pressed && styles.pressed]}>
            <Text style={styles.keyKicker}>Next key workout · +{nextPoints} pts</Text>
            <Text style={styles.keyDate}>{formatDay(nextSession.date)}</Text>
            <Text style={styles.keyTitle}>{cleanTitle(nextSession.title)}</Text>
            <View style={styles.keyMetaRow}>
              {formatMinutes(nextSession.duration) ? <Text style={styles.keyMeta}>Time {formatMinutes(nextSession.duration)}</Text> : null}
              <Text style={styles.keyMeta}>{normalizeSport(nextSession.sport)}</Text>
              <Text style={styles.keyMeta}>{nextPoints} points available</Text>
            </View>
            <Text numberOfLines={2} style={styles.keyText}>{nextSession.details?.replace(/Purpose:|Workout:|Intensity:/gi, '').trim() || 'Build durable aerobic fitness while keeping fatigue controlled.'}</Text>
            <View style={styles.keyActions}>
              <Text style={styles.openButton}>Open session</Text>
              <Text style={styles.askButton}>Ask coach</Text>
            </View>
          </Pressable>
        ) : null}

        <Text style={styles.sectionLabel}>This week</Text>
        {groups.length ? groups.slice(0, 10).map(([date, items]) => (
          <View key={date} style={styles.group}>
            <Text style={styles.date}>{formatDay(date)}</Text>
            {items.map((session, index) => {
              const status = getCompletionStatus(session, completed);
              return <SessionCard key={session.id} session={session} completed={completed} featured={index === 0 && status !== 'done'} onPress={() => setSelectedSession(session)} />;
            })}
          </View>
        )) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No sessions yet.</Text>
            <Text style={styles.emptyText}>Create a plan and your schedule will appear here.</Text>
          </View>
        )}
      </ScrollView>

      <Pressable style={styles.fab}><Text style={styles.fabText}>+</Text></Pressable>

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
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 },
  brand: { color: colors.ink, fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  title: { marginTop: 28, color: colors.ink, fontSize: 42, lineHeight: 43, fontWeight: '900', letterSpacing: -2.2 },
  month: { marginTop: 2, color: colors.muted, fontSize: 17, fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 92 },
  todayButton: { overflow: 'hidden', borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 13, paddingVertical: 9, color: colors.ink, fontWeight: '800' },
  arrowButton: { overflow: 'hidden', width: 38, height: 38, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, color: colors.ink, textAlign: 'center', paddingTop: 5, fontSize: 22, fontWeight: '700' },
  summaryCard: { marginTop: 24, flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, paddingVertical: 16, ...shadow.card },
  summaryCol: { flex: 1, alignItems: 'center', paddingHorizontal: 10 },
  summaryDivider: { width: 1, backgroundColor: colors.border },
  summaryValue: { color: colors.ink, fontSize: 22, fontWeight: '900', letterSpacing: -0.8 },
  summaryLabel: { marginTop: 6, color: colors.muted, fontSize: 12, fontWeight: '700' },
  weekStrip: { marginTop: 14, flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 14, ...shadow.card },
  dayItem: { alignItems: 'center', gap: 8, minWidth: 34 },
  dayLetter: { color: colors.faint, fontSize: 11, fontWeight: '900' },
  dayNumber: { color: colors.inkSoft, fontSize: 17, fontWeight: '800', width: 30, height: 30, textAlign: 'center', paddingTop: 4, borderRadius: 999 },
  dayNumberActive: { backgroundColor: colors.orange, color: colors.surface },
  dayDot: { width: 5, height: 5, borderRadius: 999, backgroundColor: colors.borderStrong },
  dayDotActive: { backgroundColor: colors.purple },
  keyCard: { marginTop: 26, overflow: 'hidden', backgroundColor: colors.cream, borderColor: '#ead7c2', borderWidth: 1, borderRadius: radius.xl, padding: 20, ...shadow.card },
  keyKicker: { color: colors.orange, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2 },
  keyDate: { marginTop: 14, color: colors.muted, fontSize: 14, fontWeight: '700' },
  keyTitle: { marginTop: 5, color: colors.ink, fontSize: 31, lineHeight: 34, fontWeight: '900', letterSpacing: -1.2 },
  keyMetaRow: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  keyMeta: { color: colors.inkSoft, fontSize: 13, fontWeight: '800' },
  keyText: { marginTop: 10, color: colors.inkSoft, fontSize: 14, lineHeight: 21, maxWidth: '90%' },
  keyActions: { marginTop: 18, flexDirection: 'row', gap: 10 },
  openButton: { flex: 1, overflow: 'hidden', borderRadius: 16, backgroundColor: colors.ink, color: colors.surface, textAlign: 'center', paddingVertical: 14, fontWeight: '900' },
  askButton: { flex: 1, overflow: 'hidden', borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, color: colors.ink, textAlign: 'center', paddingVertical: 14, fontWeight: '900' },
  sectionLabel: { marginTop: 28, marginBottom: 12, color: colors.faint, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.4 },
  group: { marginBottom: 12 },
  date: { marginBottom: 8, color: colors.muted, fontSize: 13, fontWeight: '900' },
  emptyCard: { backgroundColor: colors.surface, borderRadius: radius.xl, borderColor: colors.border, borderWidth: 1, padding: 20, ...shadow.card },
  emptyTitle: { color: colors.ink, fontSize: 23, fontWeight: '900', letterSpacing: -0.8 },
  emptyText: { marginTop: 8, color: colors.muted, fontSize: 14, lineHeight: 22 },
  pressed: { transform: [{ scale: 0.992 }], opacity: 0.94 },
  fab: { position: 'absolute', right: 22, bottom: 106, width: 62, height: 62, borderRadius: 999, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', ...shadow.floating },
  fabText: { color: colors.surface, fontSize: 34, lineHeight: 36, fontWeight: '300' },
});
