import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { colors, radius, shadow, spacing } from '../design/theme';
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
  const now = new Date();
  const diffMs = value.getTime() - now.getTime();
  const days = Math.max(0, Math.ceil(diffMs / 86400000));
  if (days <= 1) return 'Resets tomorrow';
  return `Resets in ${days} days`;
}

function cleanTitle(value?: string | null) {
  return String(value ?? 'Training Session')
    .replace(/^[^A-Za-z0-9]+/, '')
    .replace(/^(swim|bike|run|brick|strength|rest)\s*:?\s*/i, '')
    .trim() || 'Training Session';
}

function sportIcon(value?: string | null) {
  const sport = normalizeSport(value);
  if (sport === 'Swim') return '≈';
  if (sport === 'Bike') return '◌';
  if (sport === 'Run') return '⌁';
  if (sport === 'Brick') return '↯';
  if (sport === 'Strength') return '▣';
  return '•';
}

function sportTint(value?: string | null) {
  const sport = normalizeSport(value);
  if (sport === 'Swim') return '#e0f2fe';
  if (sport === 'Bike') return '#dcfce7';
  if (sport === 'Run') return '#ffedd5';
  if (sport === 'Brick') return '#f5f3ff';
  if (sport === 'Strength') return '#f3e8ff';
  return colors.surfaceMuted;
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
  if (!hasTrainingData) return 'Build toward race day.';
  if (score >= 80) return 'You are in the race-ready range.';
  if (score >= 65) return 'You are tracking well.';
  return 'Keep stacking the work.';
}

function isFutureSession(date?: string | null) {
  if (!date) return false;
  const sessionDate = new Date(`${date}T00:00:00`);
  const today = startOfToday();
  return sessionDate > today;
}

export function ProgressScreen() {
  const { user } = useAuth();
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
    const next = [...existing, { user_id: user.id, date: session.date, session_title: String(session.title), status: 'done' }];
    setCompleted(next);
    await supabase.from('completed_sessions').delete().eq('user_id', user.id).eq('date', session.date).eq('session_title', session.title);
    await supabase.from('completed_sessions').insert({ user_id: user.id, date: session.date, session_title: session.title, status: 'done' });
  };

  const skipSession = async (session: SessionRow) => {
    if (!user?.id || !session.title || isFutureSession(session.date)) return;
    const existing = completed.filter((row) => row.date !== session.date || row.session_title !== session.title);
    const next = [...existing, { user_id: user.id, date: session.date, session_title: String(session.title), status: 'skipped' }];
    setCompleted(next);
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
      const weekScore = Math.round((weekDone / weekSessions.length) * 100);
      if (weekScore >= 80) weeklyAdherenceStreak += 1;
      else break;
    }

    const streakBonus = clamp(currentSessionStreak * 2 + weeklyAdherenceStreak * 4, 0, 12);
    const score = hasTrainingData ? clamp(Math.round(pointsToDateScore * 0.34 + weeklyPointsScore * 0.42 + planAdherence * 0.12 + weeklyAdherence * 0.06 + streakBonus), 1, 99) : 0;
    const weeklyPercent = weeklyPoints.available ? clamp(Math.round((weeklyPoints.earned / weeklyPoints.available) * 100), 0, 100) : 0;
    const pointsToGo = Math.max(weeklyPoints.available - weeklyPoints.earned, 0);
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
      pointsToGo,
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
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <View style={styles.heroHeader}>
          <Text style={styles.kicker}>Race readiness</Text>
          <View style={styles.heroRow}>
            <View style={styles.scoreBlock}>
              <Text style={styles.scoreValue}>{readiness.hasTrainingData ? readiness.score : '—'}</Text>
              <Text style={styles.scoreMax}>/100</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{readiness.headline}</Text>
              <Text style={styles.subtitle}>Target <Text style={styles.bold}>80+</Text> by race week. Your score moves through consistency, plan adherence, key sessions, and performance data as we wire more sources in.</Text>
            </View>
          </View>
          <View style={styles.targetBar}><View style={[styles.targetFill, { width: `${clamp(readiness.score, 3, 100)}%` }]} /></View>
          <Text style={styles.targetCopy}>{readiness.label}. Keep banking quality sessions to move closer to 80.</Text>
        </View>

        <View style={styles.missionHero}>
          <Text style={styles.heroKicker}>This week</Text>
          <Text style={styles.heroTitle}>Bank {readiness.pointsAvailableThisWeek || 0} points</Text>
          <Text style={styles.heroReset}>{readiness.weekResetText}</Text>
          <View style={styles.heroPointsLine}>
            <Text style={styles.heroPoints}>{readiness.pointsThisWeek}</Text>
            <Text style={styles.heroGoal}>/ {readiness.pointsAvailableThisWeek || 0} pts</Text>
          </View>
          <View style={styles.heroProgressTrack}><View style={[styles.heroProgressFill, { width: `${readiness.weeklyPercent || 3}%` }]} /></View>
          <Text style={styles.heroToGo}>{readiness.pointsToGo} pts to go</Text>
        </View>

        <View style={styles.planCard}>
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
                <View style={[styles.sportIcon, { backgroundColor: sportTint(session.sport) }]}><Text style={styles.sportIconText}>{sportIcon(session.sport)}</Text></View>
                <View style={styles.sessionCopy}>
                  <Text style={styles.sessionTitle}>{cleanTitle(session.title)}</Text>
                  <Text style={styles.sessionMeta}>{formatSessionDate(session.date)} · {formatMinutes(session.duration) ?? 'Planned'}</Text>
                </View>
                <Text style={done ? styles.sessionPointsDone : styles.sessionPoints}>+{points} pts</Text>
                <Text style={styles.smallChevron}>›</Text>
              </Pressable>
            );
          }) : (
            <View style={styles.emptyState}><Text style={styles.emptyTitle}>No sessions this week yet.</Text><Text style={styles.emptyText}>Create a plan and your weekly point target will appear here.</Text></View>
          )}
        </View>

        {readiness.nextBest ? (
          <Pressable onPress={() => setSelectedSession(readiness.nextBest)} style={({ pressed }) => [styles.nextCard, pressed && styles.pressed]}>
            <View style={styles.nextBadge}><Text style={styles.nextBadgeText}>Highest-value remaining session</Text></View>
            <View style={styles.nextRow}>
              <View style={[styles.nextIcon, { backgroundColor: sportTint(readiness.nextBest.sport) }]}><Text style={styles.sportIconText}>{sportIcon(readiness.nextBest.sport)}</Text></View>
              <View style={styles.nextCopy}>
                <Text style={styles.nextTitle}>{cleanTitle(readiness.nextBest.title)}</Text>
                <Text style={styles.sessionMeta}>{formatMinutes(readiness.nextBest.duration) ?? 'Planned'} · most points still available this week</Text>
              </View>
              <View style={styles.nextPointsWrap}><Text style={styles.nextPoints}>+{getSessionPoints(readiness.nextBest)} pts</Text><Text style={styles.nextMeta}>available</Text></View>
            </View>
          </Pressable>
        ) : null}

        <View style={styles.pointsBoostCard}>
          <Text style={styles.boostKicker}>How readiness moves</Text>
          <Text style={styles.explainText}>This version weights weekly points, plan-to-date adherence, key session completion, and streak consistency. Next step is adding actual Strava performance trends so the score reflects not just showing up, but getting fitter.</Text>
          <View style={styles.boostGrid}>
            <View style={styles.boostItem}><Text style={styles.boostValue}>{readiness.currentSessionStreak}</Text><Text style={styles.boostTitle}>Session streak</Text></View>
            <View style={styles.boostDivider} />
            <View style={styles.boostItem}><Text style={styles.boostValue}>{readiness.weeklyAdherence}%</Text><Text style={styles.boostTitle}>Adherence</Text></View>
            <View style={styles.boostDivider} />
            <View style={styles.boostItem}><Text style={styles.boostValue}>+{readiness.streakBonus}</Text><Text style={styles.boostTitle}>Consistency boost</Text></View>
          </View>
        </View>
      </ScrollView>

      <SessionDetailSheet session={selectedSession} completed={completed} open={Boolean(selectedSession)} onClose={() => setSelectedSession(null)} onMarkDone={markDoneFor} onSkip={skipSession} onSessionUpdated={updateSessionLocally} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.pageX, paddingTop: 70, paddingBottom: spacing.pageBottom },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  kicker: { color: colors.faint, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.8 },
  heroHeader: { backgroundColor: colors.surface, borderRadius: radius.xxl, borderWidth: 1, borderColor: colors.border, padding: 18, ...shadow.card },
  heroRow: { marginTop: 12, flexDirection: 'row', gap: 16, alignItems: 'center' },
  scoreBlock: { width: 106, height: 106, borderRadius: 999, borderWidth: 8, borderColor: colors.success, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  scoreValue: { color: colors.ink, fontSize: 36, lineHeight: 38, fontWeight: '900', letterSpacing: -1.4 },
  scoreMax: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  title: { color: colors.ink, fontSize: 30, lineHeight: 31, fontWeight: '900', letterSpacing: -1.4 },
  subtitle: { marginTop: 8, color: colors.inkSoft, fontSize: 14, lineHeight: 21, fontWeight: '600' },
  bold: { color: colors.ink, fontWeight: '900' },
  targetBar: { marginTop: 18, height: 9, borderRadius: 999, backgroundColor: colors.border, overflow: 'hidden' },
  targetFill: { height: '100%', borderRadius: 999, backgroundColor: colors.success },
  targetCopy: { marginTop: 9, color: colors.muted, fontSize: 13, fontWeight: '750', lineHeight: 19 },
  missionHero: { marginTop: 14, overflow: 'hidden', backgroundColor: '#07522f', borderRadius: radius.xl, padding: 20, ...shadow.hero },
  heroKicker: { color: 'rgba(255,255,255,0.72)', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.8 },
  heroTitle: { marginTop: 10, color: colors.surface, fontSize: 31, lineHeight: 33, fontWeight: '900', letterSpacing: -1.2 },
  heroReset: { alignSelf: 'flex-start', marginTop: 10, overflow: 'hidden', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.82)', paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, fontWeight: '800' },
  heroPointsLine: { marginTop: 16, flexDirection: 'row', alignItems: 'flex-end', gap: 7 },
  heroPoints: { color: colors.surface, fontSize: 40, lineHeight: 42, fontWeight: '900', letterSpacing: -1.6 },
  heroGoal: { color: 'rgba(255,255,255,0.66)', fontSize: 19, lineHeight: 30, fontWeight: '800' },
  heroProgressTrack: { marginTop: 10, height: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.16)', overflow: 'hidden' },
  heroProgressFill: { height: '100%', borderRadius: 999, backgroundColor: '#d9f99d' },
  heroToGo: { marginTop: 8, color: '#d9f99d', fontSize: 13, fontWeight: '900' },
  planCard: { marginTop: 14, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 16, ...shadow.card },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  linkText: { color: colors.success, fontSize: 13, fontWeight: '900' },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  sessionDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  statusDot: { width: 24, height: 24, borderRadius: 999, alignItems: 'center', justifyContent: 'center', borderWidth: 1.4 },
  statusDotDone: { borderColor: colors.success, backgroundColor: colors.success },
  statusDotEmpty: { borderColor: colors.faint, borderStyle: 'dashed' },
  statusDotText: { color: colors.surface, fontSize: 12, fontWeight: '900' },
  sportIcon: { width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  sportIconText: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  sessionCopy: { flex: 1, minWidth: 0 },
  sessionTitle: { color: colors.ink, fontSize: 16, fontWeight: '900', letterSpacing: -0.4 },
  sessionMeta: { marginTop: 3, color: colors.muted, fontSize: 12, fontWeight: '650' },
  sessionPoints: { color: colors.muted, fontSize: 13, fontWeight: '900' },
  sessionPointsDone: { overflow: 'hidden', borderRadius: 999, backgroundColor: colors.successSoft, color: colors.success, paddingHorizontal: 8, paddingVertical: 5, fontSize: 12, fontWeight: '900' },
  smallChevron: { color: colors.faint, fontSize: 20, fontWeight: '700' },
  emptyState: { paddingVertical: 20 },
  emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  emptyText: { marginTop: 6, color: colors.muted, fontSize: 14, lineHeight: 21 },
  nextCard: { marginTop: 14, backgroundColor: colors.cream, borderRadius: radius.xl, borderWidth: 1, borderColor: '#eadfd2', padding: 16, ...shadow.card },
  nextBadge: { marginBottom: 12 },
  nextBadgeText: { color: colors.success, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nextIcon: { width: 52, height: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  nextCopy: { flex: 1, minWidth: 0 },
  nextTitle: { color: colors.ink, fontSize: 19, fontWeight: '900', letterSpacing: -0.6 },
  nextPointsWrap: { alignItems: 'flex-end', gap: 2 },
  nextPoints: { color: colors.success, fontSize: 22, fontWeight: '900', letterSpacing: -0.6 },
  nextMeta: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  pointsBoostCard: { marginTop: 14, backgroundColor: '#f0fdf4', borderRadius: radius.xl, borderWidth: 1, borderColor: '#dcfce7', padding: 16, ...shadow.card },
  boostKicker: { color: colors.success, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.7 },
  explainText: { marginTop: 8, color: colors.inkSoft, fontSize: 13, lineHeight: 20, fontWeight: '650' },
  boostGrid: { marginTop: 14, flexDirection: 'row', alignItems: 'stretch' },
  boostItem: { flex: 1, alignItems: 'center' },
  boostDivider: { width: 1, backgroundColor: '#bbf7d0', marginHorizontal: 8 },
  boostValue: { color: colors.success, fontSize: 24, fontWeight: '900', letterSpacing: -0.8 },
  boostTitle: { marginTop: 5, color: colors.inkSoft, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.9, textAlign: 'center' },
  pressed: { opacity: 0.72 },
});
