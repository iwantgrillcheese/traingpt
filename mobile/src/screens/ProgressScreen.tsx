import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { colors, radius, shadow, spacing } from '../design/theme';
import type { CompletedSessionRow, SessionRow } from '../types';
import { currentWeekStats, formatMinutes, normalizeSport } from '../utils/training';
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
  if (sport === 'Rest') return '·';
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
  if (!hasTrainingData) return 'Start';
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'On track';
  if (score >= 55) return 'Building';
  return 'Base';
}

function headline(score: number, hasTrainingData: boolean) {
  if (!hasTrainingData) return "You're ready to start.";
  if (score >= 70) return "You're on track.";
  if (score >= 55) return 'Keep building.';
  return 'Start banking points.';
}

export function ProgressScreen() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [completed, setCompleted] = useState<CompletedSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const [{ data: sessionRows }, { data: completedRows }] = await Promise.all([
      supabase.from('sessions').select('id,user_id,plan_id,date,sport,title,duration,details').eq('user_id', user.id).order('date', { ascending: true }).limit(700),
      supabase.from('completed_sessions').select('id,user_id,date,session_title,status').eq('user_id', user.id),
    ]);
    setSessions((sessionRows ?? []) as SessionRow[]);
    setCompleted((completedRows ?? []) as CompletedSessionRow[]);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const stats = useMemo(() => currentWeekStats(sessions, completed), [sessions, completed]);

  const fitness = useMemo(() => {
    const today = startOfToday();
    const doneKeys = new Set(
      completed
        .filter((row) => row.status === 'done')
        .map((row) => sessionCompletionKey(row.date, row.session_title))
    );

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
    const score = hasTrainingData
      ? clamp(Math.round(pointsToDateScore * 0.34 + weeklyPointsScore * 0.42 + planAdherence * 0.12 + weeklyAdherence * 0.06 + streakBonus), 1, 99)
      : 0;

    const weeklyPercent = weeklyPoints.available ? clamp(Math.round((weeklyPoints.earned / weeklyPoints.available) * 100), 0, 100) : 0;
    const pointsToGo = Math.max(weeklyPoints.available - weeklyPoints.earned, 0);
    const nextBest = weeklyPoints.sessions
      .filter((session) => !doneKeys.has(sessionCompletionKey(session.date, session.title)))
      .sort((a, b) => getSessionPoints(b) - getSessionPoints(a))[0]
      ?? [...weeklyPoints.sessions].sort((a, b) => getSessionPoints(b) - getSessionPoints(a))[0];

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
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <View style={styles.topHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>Race readiness</Text>
          <Text style={styles.title}>{fitness.headline}</Text>
          <Text style={styles.subtitle}>Keep banking quality points this week to stay ahead of race day.</Text>
        </View>

        <View style={styles.scoreWrap}>
          <View style={styles.scoreRing}>
            <Text style={styles.scoreValue}>{fitness.hasTrainingData ? fitness.score : '—'}</Text>
            <Text style={styles.scoreMax}>/100</Text>
          </View>
          <Text style={styles.scorePill}>✓ {fitness.label} for race day</Text>
        </View>
      </View>

      <View style={styles.missionHero}>
        <View style={styles.missionCopy}>
          <Text style={styles.heroKicker}>Weekly mission</Text>
          <Text style={styles.heroTitle}>Earn {fitness.pointsAvailableThisWeek || 0} points this week</Text>
          <Text style={styles.heroReset}>★ {fitness.weekResetText}</Text>
          <View style={styles.heroPointsLine}>
            <Text style={styles.heroPoints}>{fitness.pointsThisWeek}</Text>
            <Text style={styles.heroGoal}>/ {fitness.pointsAvailableThisWeek || 0} pts</Text>
          </View>
          <View style={styles.heroProgressTrack}>
            <View style={[styles.heroProgressFill, { width: `${fitness.weeklyPercent || 3}%` }]} />
          </View>
          <Text style={styles.heroToGo}>{fitness.pointsToGo} pts to go</Text>
        </View>

        <View style={styles.medalWrap}>
          <View style={styles.medalOuter}>
            <View style={styles.medalMid}>
              <View style={styles.medalInner}><Text style={styles.medalStar}>★</Text></View>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.planCard}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.kicker}>Mission plan</Text>
          <Text style={styles.linkText}>View full plan ›</Text>
        </View>

        {fitness.weekSessions.length ? fitness.weekSessions.map((session, index) => {
          const done = fitness.doneKeys.has(sessionCompletionKey(session.date, session.title));
          const points = getSessionPoints(session);
          return (
            <View key={session.id} style={[styles.sessionRow, index !== fitness.weekSessions.length - 1 && styles.sessionDivider]}>
              <View style={[styles.statusDot, done ? styles.statusDotDone : styles.statusDotEmpty]}>
                <Text style={styles.statusDotText}>{done ? '✓' : ''}</Text>
              </View>
              <View style={[styles.sportIcon, { backgroundColor: sportTint(session.sport) }]}>
                <Text style={styles.sportIconText}>{sportIcon(session.sport)}</Text>
              </View>
              <View style={styles.sessionCopy}>
                <Text style={styles.sessionTitle}>{cleanTitle(session.title)}</Text>
                <Text style={styles.sessionMeta}>{formatSessionDate(session.date)} · {formatMinutes(session.duration) ?? 'Planned'}</Text>
              </View>
              <Text style={done ? styles.sessionPointsDone : styles.sessionPoints}>+{points} pts</Text>
              <Text style={styles.smallChevron}>›</Text>
            </View>
          );
        }) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No sessions this week yet.</Text>
            <Text style={styles.emptyText}>Create a plan and your weekly point target will appear here.</Text>
          </View>
        )}
      </View>

      {fitness.nextBest ? (
        <View style={styles.nextCard}>
          <View style={styles.nextBadge}><Text style={styles.nextBadgeText}>✦ Next best workout</Text></View>
          <View style={styles.nextRow}>
            <View style={[styles.nextIcon, { backgroundColor: sportTint(fitness.nextBest.sport) }]}>
              <Text style={styles.sportIconText}>{sportIcon(fitness.nextBest.sport)}</Text>
            </View>
            <View style={styles.nextCopy}>
              <View style={styles.nextTitleRow}>
                <Text style={styles.nextTitle}>{cleanTitle(fitness.nextBest.title)}</Text>
                <Text style={styles.keyPill}>Key Session</Text>
              </View>
              <Text style={styles.sessionMeta}>{formatMinutes(fitness.nextBest.duration) ?? 'Planned'} · biggest readiness jump</Text>
            </View>
            <View style={styles.nextPointsWrap}>
              <Text style={styles.nextPoints}>+{getSessionPoints(fitness.nextBest)} pts</Text>
              <Text style={styles.nextMeta}>available</Text>
            </View>
          </View>
        </View>
      ) : null}

      <View style={styles.pointsBoostCard}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.boostKicker}>Points boost</Text>
          <Text style={styles.infoDot}>i</Text>
        </View>
        <View style={styles.boostGrid}>
          <View style={styles.boostItem}>
            <View style={styles.boostIcon}><Text style={styles.boostIconText}>♨</Text></View>
            <Text style={styles.boostTitle}>Streak Bonus</Text>
            <Text style={styles.boostText}>{fitness.currentSessionStreak}-day streak</Text>
            <Text style={styles.boostMeta}>+{fitness.streakBonus} pts</Text>
          </View>
          <View style={styles.boostDivider} />
          <View style={styles.boostItem}>
            <View style={styles.boostIcon}><Text style={styles.boostIconText}>★</Text></View>
            <Text style={styles.boostTitle}>Key Multiplier</Text>
            <Text style={styles.boostText}>Key sessions</Text>
            <Text style={styles.boostMeta}>earn more</Text>
          </View>
          <View style={styles.boostDivider} />
          <View style={styles.boostItem}>
            <View style={styles.boostIcon}><Text style={styles.boostIconText}>◷</Text></View>
            <Text style={styles.boostTitle}>Long Session</Text>
            <Text style={styles.boostText}>45+ min</Text>
            <Text style={styles.boostMeta}>bonus pts</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.pageX, paddingTop: 70, paddingBottom: spacing.pageBottom },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  topHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 18 },
  kicker: { color: colors.faint, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.8 },
  title: { marginTop: 8, color: colors.ink, fontSize: 37, lineHeight: 38, fontWeight: '900', letterSpacing: -1.8 },
  subtitle: { marginTop: 12, color: colors.inkSoft, fontSize: 15, lineHeight: 22, fontWeight: '500' },
  scoreWrap: { width: 128, alignItems: 'center', paddingTop: 4 },
  scoreRing: { width: 102, height: 102, borderRadius: 999, borderWidth: 7, borderColor: colors.success, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  scoreValue: { color: colors.ink, fontSize: 35, lineHeight: 36, fontWeight: '900', letterSpacing: -1.4 },
  scoreMax: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  scorePill: { marginTop: 9, overflow: 'hidden', borderRadius: 999, backgroundColor: colors.successSoft, color: colors.success, paddingHorizontal: 9, paddingVertical: 6, fontSize: 11, fontWeight: '900', textAlign: 'center' },
  missionHero: { marginTop: 26, minHeight: 240, flexDirection: 'row', overflow: 'hidden', backgroundColor: '#07522f', borderRadius: radius.xl, padding: 20, ...shadow.hero },
  missionCopy: { flex: 1, minWidth: 0, justifyContent: 'space-between' },
  heroKicker: { color: 'rgba(255,255,255,0.72)', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.8 },
  heroTitle: { marginTop: 12, color: colors.surface, fontSize: 30, lineHeight: 32, fontWeight: '900', letterSpacing: -1.2 },
  heroReset: { alignSelf: 'flex-start', marginTop: 10, overflow: 'hidden', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.82)', paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, fontWeight: '800' },
  heroPointsLine: { marginTop: 16, flexDirection: 'row', alignItems: 'flex-end', gap: 7 },
  heroPoints: { color: colors.surface, fontSize: 40, lineHeight: 42, fontWeight: '900', letterSpacing: -1.6 },
  heroGoal: { color: 'rgba(255,255,255,0.66)', fontSize: 19, lineHeight: 30, fontWeight: '800' },
  heroProgressTrack: { marginTop: 10, height: 10, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.16)', overflow: 'hidden' },
  heroProgressFill: { height: '100%', borderRadius: 999, backgroundColor: '#d9f99d' },
  heroToGo: { marginTop: 8, color: '#d9f99d', fontSize: 13, fontWeight: '900' },
  medalWrap: { width: 128, alignItems: 'center', justifyContent: 'center' },
  medalOuter: { width: 116, height: 116, borderRadius: 999, backgroundColor: 'rgba(134,239,172,0.18)', alignItems: 'center', justifyContent: 'center' },
  medalMid: { width: 88, height: 88, borderRadius: 999, backgroundColor: '#86efac', alignItems: 'center', justifyContent: 'center' },
  medalInner: { width: 58, height: 58, borderRadius: 999, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  medalStar: { color: colors.surface, fontSize: 28, fontWeight: '900' },
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
  nextTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  nextTitle: { color: colors.ink, fontSize: 19, fontWeight: '900', letterSpacing: -0.6 },
  keyPill: { overflow: 'hidden', borderRadius: 999, backgroundColor: colors.ink, color: colors.surface, paddingHorizontal: 8, paddingVertical: 4, fontSize: 10, fontWeight: '900' },
  nextPointsWrap: { alignItems: 'flex-end', gap: 2 },
  nextPoints: { color: colors.success, fontSize: 22, fontWeight: '900', letterSpacing: -0.6 },
  nextMeta: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  pointsBoostCard: { marginTop: 14, backgroundColor: '#f0fdf4', borderRadius: radius.xl, borderWidth: 1, borderColor: '#dcfce7', padding: 16, ...shadow.card },
  boostKicker: { color: colors.success, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.7 },
  infoDot: { color: colors.success, fontSize: 12, fontWeight: '900' },
  boostGrid: { marginTop: 14, flexDirection: 'row', alignItems: 'stretch' },
  boostItem: { flex: 1, alignItems: 'center' },
  boostDivider: { width: 1, backgroundColor: '#bbf7d0', marginHorizontal: 8 },
  boostIcon: { width: 38, height: 38, borderRadius: 999, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  boostIconText: { color: colors.surface, fontSize: 16, fontWeight: '900' },
  boostTitle: { marginTop: 8, color: colors.success, fontSize: 11, fontWeight: '900', textAlign: 'center' },
  boostText: { marginTop: 4, color: colors.inkSoft, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  boostMeta: { marginTop: 2, color: colors.success, fontSize: 11, fontWeight: '900', textAlign: 'center' },
});
