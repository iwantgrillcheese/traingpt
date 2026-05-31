import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, spacing } from '../design/theme';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import type { CompletedSessionRow, SessionRow } from '../types';
import { SessionCard } from '../components/SessionCard';
import { SessionDetailSheet } from '../components/SessionDetailSheet';
import { cleanTitle, currentWeekStats, formatDay, formatMinutes, getNextSession, getTodaysSessions, normalizeSport } from '../utils/training';

function formatToday() {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
}

function coachRead(stats: ReturnType<typeof currentWeekStats>) {
  if (!stats.planned) return 'Build the plan first. Then this becomes your daily training room.';
  if (stats.adherence >= 80) return 'Good day to build, not test.';
  if (stats.adherence >= 45) return 'Stay steady and protect the key sessions.';
  return 'Reset the week. One good session gets the rhythm back.';
}

export function TodayScreen() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [completed, setCompleted] = useState<CompletedSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<SessionRow | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setError(null);

    const [{ data: sessionRows, error: sessionError }, { data: completedRows, error: completedError }] = await Promise.all([
      supabase.from('sessions').select('id,user_id,plan_id,date,sport,title,duration,details,structured_workout').eq('user_id', user.id).order('date', { ascending: true }).limit(400),
      supabase.from('completed_sessions').select('id,user_id,date,session_title,status').eq('user_id', user.id),
    ]);

    if (sessionError || completedError) {
      setError(sessionError?.message ?? completedError?.message ?? 'Could not load training data.');
    }

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

  const todaysSessions = useMemo(() => getTodaysSessions(sessions), [sessions]);
  const nextSession = useMemo(() => getNextSession(sessions), [sessions]);
  const heroSession = todaysSessions[0] ?? nextSession;
  const stats = useMemo(() => currentWeekStats(sessions, completed), [sessions, completed]);
  const upcoming = useMemo(
    () => sessions.filter((session) => new Date(`${session.date}T00:00:00`) >= new Date(new Date().setHours(0, 0, 0, 0))).slice(0, 3),
    [sessions]
  );

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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>Opening your training room…</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.brand}>TrainGPT</Text>
            <Text style={styles.date}>{formatToday()}</Text>
          </View>
          <View style={styles.iconRow}>
            <View style={styles.iconButton}><Text style={styles.iconButtonText}>♡</Text></View>
            <View style={styles.iconButton}><Text style={styles.iconButtonText}>◎</Text></View>
          </View>
        </View>

        <Text style={styles.screenTitle}>Today’s read</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.insightCard}>
          <Text style={styles.insightKicker}>✦ Coaching insight</Text>
          <Text style={styles.insightTitle}>{coachRead(stats)}</Text>
          <Text style={styles.insightText}>Focus on the work that moves the week forward. Keep the easy work honest, protect the key session, and avoid turning today into a fitness test.</Text>
          <View style={styles.contourDot} />
        </View>

        {heroSession ? (
          <Pressable onPress={() => setSelectedSession(heroSession)} style={({ pressed }) => [styles.sessionHero, pressed && styles.pressed]}>
            <View style={styles.sessionHeader}>
              <Text style={styles.cardKicker}>Today’s session</Text>
              <Text style={styles.plannedPill}>✓ Planned</Text>
            </View>
            <Text style={styles.sessionTitle}>{cleanTitle(heroSession.title)}</Text>
            <View style={styles.metricLine}>
              {formatMinutes(heroSession.duration) ? <Text style={styles.metricText}>◷ {formatMinutes(heroSession.duration)}</Text> : null}
              <Text style={styles.metricText}>{normalizeSport(heroSession.sport)}</Text>
              <Text style={styles.metricText}>Z2</Text>
            </View>
            <View style={styles.divider} />
            <Text style={styles.contextLabel}>Race context</Text>
            <Text style={styles.contextValue}>Build durable fitness for race day</Text>
            <Text style={styles.contextLabel}>Purpose</Text>
            <Text style={styles.contextValue}>{heroSession.details?.replace(/Purpose:|Workout:|Intensity:/gi, '').trim().slice(0, 92) || 'Execute the session with control and leave enough in the tank for the week.'}</Text>
            <View style={styles.heroActions}>
              <Pressable onPress={() => setSelectedSession(heroSession)} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                <Text style={styles.primaryText}>Open session</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                <Text style={styles.secondaryText}>Ask coach</Text>
              </Pressable>
            </View>
          </Pressable>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyKicker}>No plan yet</Text>
            <Text style={styles.emptyTitle}>Build your first training plan.</Text>
            <Text style={styles.emptyText}>Use the Plan tab to create a calendar. Once it’s live, Today becomes your daily training room.</Text>
          </View>
        )}

        <View style={styles.statsStrip}>
          <View style={styles.statCol}><Text style={styles.statValue}>{stats.done}/{stats.planned || 0}</Text><Text style={styles.statLabel}>Sessions complete</Text></View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}><Text style={styles.statValue}>{formatMinutes(stats.minutes) ?? '—'}</Text><Text style={styles.statLabel}>Planned time</Text></View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}><Text style={styles.statValue}>{stats.planned ? `${stats.adherence}%` : '—'}</Text><Text style={styles.statLabel}>Adherence</Text></View>
        </View>

        <View style={styles.stravaInsight}>
          <View style={styles.stravaIcon}><Text style={styles.stravaIconText}>◌</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.stravaKicker}>Yesterday · Ride</Text>
            <Text style={styles.stravaTitle}>Matched well</Text>
            <Text style={styles.stravaMeta}>197W avg · 148 bpm avg · 21.3 mi</Text>
            <Text style={styles.stravaCopy}>Great aerobic day. You stayed steady and finished strong—perfect prep for today.</Text>
          </View>
          <View style={styles.sparkline}><View style={styles.sparkFill} /></View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Up next</Text>
          <Text style={styles.sectionHint}>Pull to refresh</Text>
        </View>
        {upcoming.length ? upcoming.map((session) => (
          <SessionCard key={session.id} session={session} completed={completed} onPress={() => setSelectedSession(session)} />
        )) : (
          <Text style={styles.emptyListText}>No upcoming sessions yet.</Text>
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
  content: { padding: spacing.pageX, paddingTop: 62, paddingBottom: 138 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: 10, color: colors.muted, fontWeight: '700' },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  brand: { color: colors.ink, fontSize: 20, fontWeight: '900', letterSpacing: -0.7 },
  date: { marginTop: 2, color: colors.muted, fontSize: 15, fontWeight: '600' },
  iconRow: { flexDirection: 'row', gap: 10 },
  iconButton: { width: 40, height: 40, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  iconButtonText: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  screenTitle: { marginTop: 34, color: colors.ink, fontSize: 42, lineHeight: 44, fontWeight: '900', letterSpacing: -2.2 },
  error: { marginTop: 14, color: colors.danger, fontWeight: '800' },
  insightCard: { marginTop: 18, minHeight: 178, overflow: 'hidden', backgroundColor: colors.cream, borderRadius: radius.xl, borderColor: '#eadfd2', borderWidth: 1, padding: 20, ...shadow.card },
  insightKicker: { color: '#a67c52', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2 },
  insightTitle: { marginTop: 20, color: colors.ink, fontSize: 30, lineHeight: 34, fontWeight: '900', letterSpacing: -1.3 },
  insightText: { marginTop: 12, color: colors.inkSoft, fontSize: 15, lineHeight: 24, maxWidth: '86%' },
  contourDot: { position: 'absolute', right: 38, bottom: 42, width: 26, height: 26, borderRadius: 999, backgroundColor: '#d8bda0', opacity: 0.45 },
  sessionHero: { marginTop: 14, backgroundColor: colors.surface, borderRadius: radius.xl, borderColor: colors.border, borderWidth: 1, padding: 18, ...shadow.card },
  sessionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardKicker: { color: colors.faint, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.3 },
  plannedPill: { overflow: 'hidden', backgroundColor: colors.successSoft, color: colors.success, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, fontSize: 12, fontWeight: '900' },
  sessionTitle: { marginTop: 12, color: colors.ink, fontSize: 30, lineHeight: 33, fontWeight: '900', letterSpacing: -1.2 },
  metricLine: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 12 },
  metricText: { color: colors.inkSoft, fontSize: 14, fontWeight: '800' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 16 },
  contextLabel: { color: colors.ink, fontSize: 15, fontWeight: '900', marginTop: 6 },
  contextValue: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 3 },
  heroActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  primaryButton: { flex: 1.2, minHeight: 52, backgroundColor: colors.ink, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: colors.surface, fontWeight: '900', fontSize: 15 },
  secondaryButton: { flex: 1, minHeight: 52, borderColor: colors.borderStrong, borderWidth: 1, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  secondaryText: { color: colors.ink, fontWeight: '900', fontSize: 15 },
  pressed: { transform: [{ scale: 0.992 }], opacity: 0.94 },
  emptyCard: { marginTop: 14, backgroundColor: colors.surface, borderRadius: radius.xxl, borderColor: colors.border, borderWidth: 1, padding: 24, ...shadow.card },
  emptyKicker: { color: colors.faint, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 },
  emptyTitle: { marginTop: 10, color: colors.ink, fontSize: 30, lineHeight: 32, fontWeight: '900', letterSpacing: -1.3 },
  emptyText: { marginTop: 10, color: colors.muted, fontSize: 14, lineHeight: 22 },
  statsStrip: { marginTop: 14, flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, paddingVertical: 16, ...shadow.card },
  statCol: { flex: 1, paddingHorizontal: 13 },
  statDivider: { width: 1, backgroundColor: colors.border },
  statValue: { color: colors.ink, fontSize: 24, fontWeight: '900', letterSpacing: -1 },
  statLabel: { marginTop: 6, color: colors.muted, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  stravaInsight: { marginTop: 14, flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 16, ...shadow.card },
  stravaIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' },
  stravaIconText: { color: colors.blue, fontSize: 20, fontWeight: '900' },
  stravaKicker: { color: colors.faint, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2 },
  stravaTitle: { marginTop: 4, color: colors.ink, fontSize: 21, fontWeight: '900', letterSpacing: -0.7 },
  stravaMeta: { marginTop: 3, color: colors.inkSoft, fontSize: 13, fontWeight: '700' },
  stravaCopy: { marginTop: 9, color: colors.muted, fontSize: 13, lineHeight: 20 },
  sparkline: { width: 86, height: 42, borderRadius: 12, backgroundColor: colors.purpleSoft, overflow: 'hidden', marginTop: 22 },
  sparkFill: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 22, backgroundColor: '#c4b5fd' },
  sectionHeader: { marginTop: 28, marginBottom: 10, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  sectionTitle: { color: colors.ink, fontSize: 23, fontWeight: '900', letterSpacing: -0.9 },
  sectionHint: { color: colors.faint, fontSize: 12, fontWeight: '800' },
  emptyListText: { color: colors.muted, fontSize: 14, lineHeight: 22 },
  fab: { position: 'absolute', right: 22, bottom: 106, width: 62, height: 62, borderRadius: 999, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', ...shadow.floating },
  fabText: { color: colors.surface, fontSize: 34, lineHeight: 36, fontWeight: '300' },
});
