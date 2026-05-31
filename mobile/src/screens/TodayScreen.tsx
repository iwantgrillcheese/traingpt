import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import type { CompletedSessionRow, SessionRow } from '../types';
import { SessionCard } from '../components/SessionCard';
import { SessionDetailSheet } from '../components/SessionDetailSheet';
import { cleanTitle, currentWeekStats, formatMinutes, getNextSession, getTodaysSessions, normalizeSport } from '../utils/training';

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

  useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const todaysSessions = useMemo(() => getTodaysSessions(sessions), [sessions]);
  const nextSession = useMemo(() => getNextSession(sessions), [sessions]);
  const heroSession = todaysSessions[0] ?? nextSession;
  const stats = useMemo(() => currentWeekStats(sessions, completed), [sessions, completed]);

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
    return <View style={styles.center}><ActivityIndicator /><Text style={styles.loadingText}>Loading your training day…</Text></View>;
  }

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <Text style={styles.kicker}>Today</Text>
        <Text style={styles.title}>Your training day</Text>
        <Text style={styles.subtitle}>A native daily command center for the work that actually matters.</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {heroSession ? (
          <Pressable onPress={() => setSelectedSession(heroSession)} style={({ pressed }) => [styles.heroCard, pressed && styles.pressed]}>
            <Text style={styles.heroMeta}>{normalizeSport(heroSession.sport)}{formatMinutes(heroSession.duration) ? ` · ${formatMinutes(heroSession.duration)}` : ''}</Text>
            <Text style={styles.heroTitle}>{cleanTitle(heroSession.title)}</Text>
            <Text numberOfLines={3} style={styles.heroText}>{heroSession.details?.replace(/Purpose:|Workout:|Intensity:/gi, '').trim() || 'Open the session to see the full workout and coaching context.'}</Text>
            <View style={styles.actions}>
              <Pressable onPress={() => markDoneFor(heroSession)} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                <Text style={styles.primaryText}>Mark done</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                <Text style={styles.secondaryText}>Ask coach</Text>
              </Pressable>
            </View>
          </Pressable>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No session today</Text>
            <Text style={styles.emptyText}>Generate a plan on web and your native app will become the daily companion.</Text>
          </View>
        )}

        <View style={styles.statsGrid}>
          <View style={styles.statCard}><Text style={styles.statLabel}>Complete</Text><Text style={styles.statValue}>{stats.done}/{stats.planned}</Text></View>
          <View style={styles.statCard}><Text style={styles.statLabel}>Volume</Text><Text style={styles.statValue}>{formatMinutes(stats.minutes) ?? '—'}</Text></View>
          <View style={styles.statCard}><Text style={styles.statLabel}>Adherence</Text><Text style={styles.statValue}>{stats.planned ? `${stats.adherence}%` : '—'}</Text></View>
        </View>

        <Text style={styles.sectionTitle}>Upcoming</Text>
        {sessions.filter((session) => new Date(`${session.date}T00:00:00`) >= new Date(new Date().setHours(0, 0, 0, 0))).slice(0, 5).map((session) => (
          <SessionCard key={session.id} session={session} completed={completed} onPress={() => setSelectedSession(session)} />
        ))}
      </ScrollView>

      <SessionDetailSheet
        session={selectedSession}
        completed={completed}
        open={Boolean(selectedSession)}
        onClose={() => setSelectedSession(null)}
        onMarkDone={markDoneFor}
        onSkip={skipSession}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fbfbfa' },
  content: { padding: 20, paddingTop: 72, paddingBottom: 120 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fbfbfa' },
  loadingText: { marginTop: 10, color: '#71717a', fontWeight: '600' },
  kicker: { color: '#71717a', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.8 },
  title: { marginTop: 8, color: '#09090b', fontSize: 38, lineHeight: 38, fontWeight: '800', letterSpacing: -1.8 },
  subtitle: { marginTop: 10, color: '#71717a', fontSize: 14, lineHeight: 22 },
  error: { marginTop: 14, color: '#be123c', fontWeight: '700' },
  heroCard: { marginTop: 22, backgroundColor: '#09090b', borderRadius: 30, padding: 22 },
  heroMeta: { color: '#a1a1aa', fontSize: 13, fontWeight: '700' },
  heroTitle: { marginTop: 10, color: '#fff', fontSize: 30, lineHeight: 32, fontWeight: '800', letterSpacing: -1.2 },
  heroText: { marginTop: 12, color: '#d4d4d8', fontSize: 14, lineHeight: 22 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  primaryButton: { flex: 1, minHeight: 50, backgroundColor: '#fff', borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#09090b', fontWeight: '800' },
  secondaryButton: { flex: 1, minHeight: 50, borderColor: '#3f3f46', borderWidth: 1, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#fff', fontWeight: '800' },
  pressed: { transform: [{ scale: 0.99 }], opacity: 0.9 },
  emptyCard: { marginTop: 22, backgroundColor: '#fff', borderRadius: 26, borderColor: '#e4e4e7', borderWidth: 1, padding: 22 },
  emptyTitle: { color: '#09090b', fontSize: 20, fontWeight: '800' },
  emptyText: { marginTop: 8, color: '#71717a', fontSize: 14, lineHeight: 22 },
  statsGrid: { flexDirection: 'row', gap: 8, marginTop: 14 },
  statCard: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 20, padding: 12 },
  statLabel: { color: '#a1a1aa', fontSize: 11, fontWeight: '700' },
  statValue: { marginTop: 4, color: '#09090b', fontSize: 20, fontWeight: '800', letterSpacing: -0.8 },
  sectionTitle: { marginTop: 26, marginBottom: 10, color: '#09090b', fontSize: 22, fontWeight: '800', letterSpacing: -0.8 },
});
