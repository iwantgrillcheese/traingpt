import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, spacing } from '../design/theme';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import type { CompletedSessionRow, SessionRow } from '../types';
import { SessionCard } from '../components/SessionCard';
import { SessionDetailSheet } from '../components/SessionDetailSheet';
import { cleanTitle, currentWeekStats, formatDay, formatMinutes, getNextSession, getTodaysSessions, normalizeSport } from '../utils/training';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function shortFirstName(email?: string | null) {
  const value = email?.split('@')[0] ?? 'athlete';
  return value.split(/[._-]/)[0] || 'athlete';
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
    () => sessions.filter((session) => new Date(`${session.date}T00:00:00`) >= new Date(new Date().setHours(0, 0, 0, 0))).slice(0, 5),
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
        <Text style={styles.loadingText}>Loading today’s training…</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.kicker}>TrainGPT</Text>
            <Text style={styles.greeting}>{greeting()}, {shortFirstName(user?.email)}</Text>
          </View>
          <View style={styles.statusPill}><Text style={styles.statusPillText}>Live plan</Text></View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {heroSession ? (
          <Pressable onPress={() => setSelectedSession(heroSession)} style={({ pressed }) => [styles.heroCard, pressed && styles.pressed]}>
            <View style={styles.heroHeader}>
              <Text style={styles.heroEyebrow}>Today’s work</Text>
              <Text style={styles.heroDate}>{formatDay(heroSession.date)}</Text>
            </View>
            <Text style={styles.heroSport}>{normalizeSport(heroSession.sport)}{formatMinutes(heroSession.duration) ? ` · ${formatMinutes(heroSession.duration)}` : ''}</Text>
            <Text style={styles.heroTitle}>{cleanTitle(heroSession.title)}</Text>
            <Text numberOfLines={3} style={styles.heroText}>{heroSession.details?.replace(/Purpose:|Workout:|Intensity:/gi, '').trim() || 'Open this session for the workout, notes, and completion actions.'}</Text>
            <View style={styles.heroActions}>
              <Pressable onPress={() => markDoneFor(heroSession)} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                <Text style={styles.primaryText}>Mark done</Text>
              </Pressable>
              <Pressable onPress={() => setSelectedSession(heroSession)} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                <Text style={styles.secondaryText}>View session</Text>
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

        <View style={styles.statsGrid}>
          <View style={styles.statCard}><Text style={styles.statLabel}>Done</Text><Text style={styles.statValue}>{stats.done}/{stats.planned}</Text></View>
          <View style={styles.statCard}><Text style={styles.statLabel}>Volume</Text><Text style={styles.statValue}>{formatMinutes(stats.minutes) ?? '—'}</Text></View>
          <View style={styles.statCard}><Text style={styles.statLabel}>Adherence</Text><Text style={styles.statValue}>{stats.planned ? `${stats.adherence}%` : '—'}</Text></View>
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
  content: { padding: spacing.pageX, paddingTop: 66, paddingBottom: 132 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: 10, color: colors.muted, fontWeight: '700' },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  kicker: { color: colors.faint, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.8 },
  greeting: { marginTop: 8, color: colors.ink, fontSize: 34, lineHeight: 36, fontWeight: '900', letterSpacing: -1.7, textTransform: 'capitalize' },
  statusPill: { borderRadius: 999, backgroundColor: colors.brandSoft, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.border },
  statusPillText: { color: colors.ink, fontSize: 11, fontWeight: '900' },
  error: { marginTop: 14, color: colors.danger, fontWeight: '800' },
  heroCard: { marginTop: 24, backgroundColor: colors.ink, borderRadius: radius.xxl, padding: 24, ...shadow.hero },
  heroHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroEyebrow: { color: '#d6d3d1', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 },
  heroDate: { color: '#a8a29e', fontSize: 12, fontWeight: '800' },
  heroSport: { marginTop: 24, color: '#d6d3d1', fontSize: 14, fontWeight: '800' },
  heroTitle: { marginTop: 8, color: colors.surface, fontSize: 34, lineHeight: 35, fontWeight: '900', letterSpacing: -1.5 },
  heroText: { marginTop: 14, color: '#d6d3d1', fontSize: 14, lineHeight: 22 },
  heroActions: { flexDirection: 'row', gap: 10, marginTop: 22 },
  primaryButton: { flex: 1, minHeight: 52, backgroundColor: colors.surface, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: colors.ink, fontWeight: '900' },
  secondaryButton: { flex: 1, minHeight: 52, borderColor: '#44403c', borderWidth: 1, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.surface, fontWeight: '900' },
  pressed: { transform: [{ scale: 0.992 }], opacity: 0.94 },
  emptyCard: { marginTop: 24, backgroundColor: colors.surface, borderRadius: radius.xxl, borderColor: colors.border, borderWidth: 1, padding: 24, ...shadow.card },
  emptyKicker: { color: colors.faint, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 },
  emptyTitle: { marginTop: 10, color: colors.ink, fontSize: 30, lineHeight: 32, fontWeight: '900', letterSpacing: -1.3 },
  emptyText: { marginTop: 10, color: colors.muted, fontSize: 14, lineHeight: 22 },
  statsGrid: { flexDirection: 'row', gap: 8, marginTop: 14 },
  statCard: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 13, ...shadow.card },
  statLabel: { color: colors.faint, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  statValue: { marginTop: 6, color: colors.ink, fontSize: 19, fontWeight: '900', letterSpacing: -0.8 },
  sectionHeader: { marginTop: 28, marginBottom: 10, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  sectionTitle: { color: colors.ink, fontSize: 23, fontWeight: '900', letterSpacing: -0.9 },
  sectionHint: { color: colors.faint, fontSize: 12, fontWeight: '800' },
  emptyListText: { color: colors.muted, fontSize: 14, lineHeight: 22 },
});
