import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { colors, radius, shadow, spacing, typography } from '../design/theme';
import type { CompletedSessionRow, SessionRow } from '../types';
import { currentWeekStats, formatMinutes, normalizeSport } from '../utils/training';
import { SessionDetailSheet } from '../components/SessionDetailSheet';
import {
  getActiveWeekReferenceDate,
  getEarnedPoints,
  getSessionPoints,
  getTotalAvailablePoints,
  getWeeklyPointStats,
  sessionCompletionKey,
} from '../utils/sessionPoints';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

function formatSessionDate(value?: string | null) {
  if (!value) return 'Planned';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 'Planned';
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(date);
}

function formatCountdown(value?: Date | null) {
  if (!value) return 'Resets soon';
  const diffMs = value.getTime() - new Date().getTime();
  const days = Math.max(0, Math.ceil(diffMs / 86400000));
  return days <= 1 ? 'Resets tomorrow' : `Resets in ${days} days`;
}

function cleanTitle(value?: string | null) {
  return String(value ?? 'Training Session')
    .replace(/^[^A-Za-z0-9]+/, '')
    .replace(/^(swim|bike|run|brick|strength|rest)\s*:?\s*/i, '')
    .trim() || 'Training Session';
}

function scoreLabel(score: number, hasTrainingData: boolean) {
  if (!hasTrainingData) return 'Start building';
  if (score >= 85) return 'Excellent';
  if (score >= 80) return 'Race-ready range';
  if (score >= 65) return 'On track';
  if (score >= 45) return 'Building';
  return 'Foundation';
}

function headline(score: number, hasTrainingData: boolean) {
  if (!hasTrainingData) return 'Build toward race day';
  if (score >= 80) return 'You are in the race-ready range';
  if (score >= 65) return 'You are tracking well';
  return 'Keep stacking the work';
}

function isFutureSession(date?: string | null) {
  if (!date) return false;
  return new Date(`${date}T00:00:00`) > startOfToday();
}

export function ProgressScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [completed, setCompleted] = useState<CompletedSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionRow | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const [{ data: sessionRows }, { data: completedRows }] = await Promise.all([
      supabase.from('sessions').select('id,user_id,plan_id,date,sport,title,duration,details,structured_workout').eq('user_id', user.id).order('date', { ascending: true }).limit(700),
      supabase.from('completed_sessions').select('id,user_id,date,session_title,status').eq('user_id', user.id),
    ]);
    setSessions((sessionRows ?? []) as SessionRow[]);
    setCompleted((completedRows ?? []) as CompletedSessionRow[]);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

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
    if (!user?.id || !session.title || isFutureSession(session.date)) return;
    const existing = completed.filter((row) => row.date !== session.date || row.session_title !== session.title);
    setCompleted([...existing, { user_id: user.id, date: session.date, session_title: String(session.title), status: 'done' }]);
    await supabase.from('completed_sessions').delete().eq('user_id', user.id).eq('date', session.date).eq('session_title', session.title);
    await supabase.from('completed_sessions').insert({ user_id: user.id, date: session.date, session_title: session.title, status: 'done' });
  };

  const skipSession = async (session: SessionRow) => {
    if (!user?.id || !session.title || isFutureSession(session.date)) return;
    const existing = completed.filter((row) => row.date !== session.date || row.session_title !== session.title);
    setCompleted([...existing, { user_id: user.id, date: session.date, session_title: String(session.title), status: 'skipped' }]);
    await supabase.from('completed_sessions').delete().eq('user_id', user.id).eq('date', session.date).eq('session_title', session.title);
    await supabase.from('completed_sessions').insert({ user_id: user.id, date: session.date, session_title: session.title, status: 'skipped' });
  };

  const stats = useMemo(() => currentWeekStats(sessions, completed), [sessions, completed]);

  const readiness = useMemo(() => {
    const today = startOfToday();
    const doneKeys = new Set(completed.filter((row) => row.status === 'done').map((row) => sessionCompletionKey(row.date, row.session_title)));
    const plannedToDate = sessions.filter((session) => new Date(`${session.date}T00:00:00`) <= today);
    const doneToDate = plannedToDate.filter((session) => doneKeys.has(sessionCompletionKey(session.date, session.title)));
    const hasTrainingData = plannedToDate.length > 0 || sessions.length > 0;
    const planAdherence = plannedToDate.length ? Math.round((doneToDate.length / plannedToDate.length) * 100) : 0;
    const weeklyAdherence = stats.planned ? stats.adherence : planAdherence;
    const activeReferenceDate = getActiveWeekReferenceDate(sessions, completed, today);
    const weeklyPoints = getWeeklyPointStats(sessions, completed, activeReferenceDate);
    const pointsToDateEarned = getEarnedPoints(plannedToDate, completed);
    const pointsToDateAvailable = getTotalAvailablePoints(plannedToDate);
    const pointsToDateScore = pointsToDateAvailable ? Math.round((pointsToDateEarned / pointsToDateAvailable) * 100) : 0;
    const weeklyPointsScore = weeklyPoints.available ? Math.round((weeklyPoints.earned / weeklyPoints.available) * 100) : 0;

    let currentSessionStreak = 0;
    for (let i = plannedToDate.length - 1; i >= 0; i -= 1) {
      const session = plannedToDate[i];
      if (doneKeys.has(sessionCompletionKey(session.date, session.title))) currentSessionStreak += 1;
      else break;
    }

    let weeklyAdherenceStreak = 0;
    const thisWeekStart = startOfWeek(today);
    for (let i = 0; i < 12; i += 1) {
      const weekStart = addDays(thisWeekStart, -7 * i);
      const weekEnd = addDays(weekStart, 6);
      const weekSessions = sessions.filter((session) => {
        const sessionDate = new Date(`${session.date}T00:00:00`);
        return sessionDate >= weekStart && sessionDate <= weekEnd && sessionDate <= today;
      });
      if (!weekSessions.length) break;
      const weekDone = weekSessions.filter((session) => doneKeys.has(sessionCompletionKey(session.date, session.title))).length;
      if (Math.round((weekDone / weekSessions.length) * 100) >= 80) weeklyAdherenceStreak += 1;
      else break;
    }

    const streakBonus = clamp(currentSessionStreak * 2 + weeklyAdherenceStreak * 4, 0, 12);
    const score = hasTrainingData ? clamp(Math.round(pointsToDateScore * 0.34 + weeklyPointsScore * 0.42 + planAdherence * 0.12 + weeklyAdherence * 0.06 + streakBonus), 1, 99) : 0;
    const weeklyPercent = weeklyPoints.available ? clamp(Math.round((weeklyPoints.earned / weeklyPoints.available) * 100), 0, 100) : 0;
    const nextBest = weeklyPoints.sessions
      .filter((session) => !doneKeys.has(sessionCompletionKey(session.date, session.title)))
      .sort((a, b) => getSessionPoints(b) - getSessionPoints(a))[0] ?? null;

    return {
      score,
      label: scoreLabel(score, hasTrainingData),
      headline: headline(score, hasTrainingData),
      weeklyPercent,
      pointsThisWeek: weeklyPoints.earned,
      pointsAvailableThisWeek: weeklyPoints.available,
      pointsToGo: Math.max(weeklyPoints.available - weeklyPoints.earned, 0),
      weekResetText: formatCountdown(weeklyPoints.end),
      currentSessionStreak,
      weeklyAdherence,
      streakBonus,
      weekSessions: weeklyPoints.sessions.slice(0, 5),
      doneKeys,
      nextBest,
      hasTrainingData,
    };
  }, [completed, sessions, stats.adherence, stats.planned]);

  if (loading) return <View style={styles.center}><ActivityIndicator /></View>;

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 22 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <View style={styles.heroCard}>
          <Text style={styles.kicker}>Race readiness</Text>
          <View style={styles.scoreLine}>
            <Text style={styles.scoreValue}>{readiness.hasTrainingData ? readiness.score : '—'}</Text>
            <Text style={styles.scoreMax}>/100</Text>
          </View>
          <Text style={styles.title}>{readiness.headline}</Text>
          <Text style={styles.subtitle}>Target <Text style={styles.bold}>80+</Text> by race week. Readiness moves when you complete the right sessions consistently.</Text>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${clamp(readiness.score, 3, 100)}%` }]} /></View>
          <Text style={styles.targetCopy}>{readiness.label} · {readiness.pointsToGo} pts left this week</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.kicker}>This week</Text>
            <Text style={styles.resetText}>{readiness.weekResetText}</Text>
          </View>
          <View style={styles.weekPointsLine}>
            <Text style={styles.weekPoints}>{readiness.pointsThisWeek}</Text>
            <Text style={styles.weekGoal}>/ {readiness.pointsAvailableThisWeek || 0} pts</Text>
          </View>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${readiness.weeklyPercent || 3}%` }]} /></View>
          <Text style={styles.cardCopy}>Your weekly score rewards planned work completed, not arbitrary points.</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.kicker}>Mission plan</Text>
            <Text style={styles.linkText}>Tap a session</Text>
          </View>
          {readiness.weekSessions.length ? readiness.weekSessions.map((session, index) => {
            const done = readiness.doneKeys.has(sessionCompletionKey(session.date, session.title));
            const points = getSessionPoints(session);
            return (
              <Pressable key={session.id} onPress={() => setSelectedSession(session)} style={({ pressed }) => [styles.sessionRow, index !== readiness.weekSessions.length - 1 && styles.sessionDivider, pressed && styles.pressed]}>
                <View style={[styles.statusDot, done ? styles.statusDotDone : styles.statusDotEmpty]}><Text style={styles.statusDotText}>{done ? '✓' : ''}</Text></View>
                <View style={styles.sessionCopy}>
                  <Text style={styles.sessionTitle} numberOfLines={1} ellipsizeMode="tail">{cleanTitle(session.title)}</Text>
                  <Text style={styles.sessionMeta}>{formatSessionDate(session.date)} · {formatMinutes(session.duration) ?? 'Planned'} · {normalizeSport(session.sport)}</Text>
                </View>
                <Text style={done ? styles.sessionPointsDone : styles.sessionPoints}>+{points}</Text>
                <Text style={styles.smallChevron}>›</Text>
              </Pressable>
            );
          }) : (
            <View style={styles.emptyState}><Text style={styles.emptyTitle}>No sessions this week yet</Text><Text style={styles.emptyText}>Create a plan and your weekly point target will appear here.</Text></View>
          )}
        </View>

        {readiness.nextBest ? (
          <Pressable onPress={() => setSelectedSession(readiness.nextBest)} style={({ pressed }) => [styles.nextCard, pressed && styles.pressed]}>
            <Text style={styles.kicker}>Next best workout</Text>
            <Text style={styles.nextTitle} numberOfLines={2} ellipsizeMode="tail">{cleanTitle(readiness.nextBest.title)}</Text>
            <View style={styles.nextMetaRow}>
              <Text style={styles.sessionMeta}>{formatMinutes(readiness.nextBest.duration) ?? 'Planned'} · highest-value remaining session</Text>
              <Text style={styles.nextPoints}>+{getSessionPoints(readiness.nextBest)} pts</Text>
            </View>
          </Pressable>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.kicker}>How readiness moves</Text>
          <Text style={styles.explainText}>This version weights weekly points, plan-to-date adherence, key session completion, and streak consistency. Strava performance trends can make it smarter next.</Text>
          <View style={styles.metricGrid}>
            <View style={styles.metricItem}><Text style={styles.metricValue}>{readiness.currentSessionStreak}</Text><Text style={styles.metricTitle}>Streak</Text></View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}><Text style={styles.metricValue}>{readiness.weeklyAdherence}%</Text><Text style={styles.metricTitle}>Adherence</Text></View>
            <View style={styles.metricDivider} />
            <View style={styles.metricItem}><Text style={styles.metricValue}>+{readiness.streakBonus}</Text><Text style={styles.metricTitle}>Boost</Text></View>
          </View>
        </View>
      </ScrollView>

      <SessionDetailSheet session={selectedSession} completed={completed} open={Boolean(selectedSession)} onClose={() => setSelectedSession(null)} onMarkDone={markDoneFor} onSkip={skipSession} onSessionUpdated={updateSessionLocally} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.pageX, paddingBottom: spacing.pageBottom },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  kicker: { ...typography.kicker, color: colors.faint },
  heroCard: { backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: 20, ...shadow.card },
  scoreLine: { marginTop: 14, flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  scoreValue: { color: colors.ink, fontSize: 68, lineHeight: 70, fontWeight: '800', letterSpacing: -3.2 },
  scoreMax: { color: colors.muted, fontSize: 18, lineHeight: 36, fontWeight: '700' },
  title: { marginTop: 10, color: colors.ink, fontSize: 25, lineHeight: 29, fontWeight: '800', letterSpacing: -0.9 },
  subtitle: { marginTop: 8, color: colors.inkSoft, fontSize: 14, lineHeight: 21, fontWeight: '500' },
  bold: { color: colors.ink, fontWeight: '800' },
  progressTrack: { marginTop: 18, height: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.success },
  targetCopy: { marginTop: 9, color: colors.muted, fontSize: 13, fontWeight: '600', lineHeight: 19 },
  card: { marginTop: 14, backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: 16, ...shadow.card },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 12 },
  resetText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  weekPointsLine: { marginTop: 8, flexDirection: 'row', alignItems: 'flex-end', gap: 7 },
  weekPoints: { color: colors.ink, fontSize: 34, lineHeight: 36, fontWeight: '800', letterSpacing: -1.2 },
  weekGoal: { color: colors.muted, fontSize: 17, lineHeight: 26, fontWeight: '700' },
  cardCopy: { marginTop: 9, color: colors.inkSoft, fontSize: 13, lineHeight: 20, fontWeight: '500' },
  linkText: { color: colors.success, fontSize: 13, fontWeight: '700' },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13 },
  sessionDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  statusDot: { width: 23, height: 23, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1.3 },
  statusDotDone: { borderColor: colors.success, backgroundColor: colors.success },
  statusDotEmpty: { borderColor: colors.borderStrong, backgroundColor: colors.surface },
  statusDotText: { color: colors.surface, fontSize: 12, fontWeight: '800' },
  sessionCopy: { flex: 1, minWidth: 0 },
  sessionTitle: { color: colors.ink, fontSize: 16, fontWeight: '800', letterSpacing: -0.25 },
  sessionMeta: { marginTop: 3, color: colors.muted, fontSize: 12, fontWeight: '500' },
  sessionPoints: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  sessionPointsDone: { overflow: 'hidden', borderRadius: radius.pill, backgroundColor: colors.successSoft, color: colors.success, paddingHorizontal: 8, paddingVertical: 5, fontSize: 12, fontWeight: '700' },
  smallChevron: { color: colors.faint, fontSize: 20, fontWeight: '600' },
  emptyState: { paddingVertical: 20 },
  emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  emptyText: { marginTop: 6, color: colors.muted, fontSize: 14, lineHeight: 21 },
  nextCard: { marginTop: 14, backgroundColor: colors.cream, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: 16, ...shadow.card },
  nextTitle: { marginTop: 9, color: colors.ink, fontSize: 20, lineHeight: 24, fontWeight: '800', letterSpacing: -0.6 },
  nextMetaRow: { marginTop: 8, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  nextPoints: { color: colors.success, fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  explainText: { marginTop: 8, color: colors.inkSoft, fontSize: 13, lineHeight: 20, fontWeight: '500' },
  metricGrid: { marginTop: 14, flexDirection: 'row', alignItems: 'stretch' },
  metricItem: { flex: 1, alignItems: 'center' },
  metricDivider: { width: 1, backgroundColor: colors.border, marginHorizontal: 8 },
  metricValue: { color: colors.ink, fontSize: 22, fontWeight: '800', letterSpacing: -0.6 },
  metricTitle: { marginTop: 5, color: colors.muted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center' },
  pressed: { opacity: 0.72 },
});
