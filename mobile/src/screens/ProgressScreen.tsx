import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { colors, radius, shadow, spacing } from '../design/theme';
import type { CompletedSessionRow, SessionRow } from '../types';
import { currentWeekStats, formatMinutes, normalizeSport } from '../utils/training';
import { getEarnedPoints, getSessionPoints, getTotalAvailablePoints, getWeeklyPointStats, sessionCompletionKey } from '../utils/sessionPoints';

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
  if (score >= 70) return 'Good';
  if (score >= 55) return 'Building';
  return 'Base';
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
    const hasTrainingData = plannedToDate.length > 0;

    const planAdherence = plannedToDate.length ? Math.round((doneToDate.length / plannedToDate.length) * 100) : 0;
    const weeklyAdherence = stats.planned ? stats.adherence : planAdherence;
    const weeklyPoints = getWeeklyPointStats(sessions, completed);
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
      ? clamp(Math.round(pointsToDateScore * 0.44 + weeklyPointsScore * 0.28 + planAdherence * 0.16 + weeklyAdherence * 0.08 + streakBonus), 1, 99)
      : 0;

    const weeklyPercent = weeklyPoints.available ? clamp(Math.round((weeklyPoints.earned / weeklyPoints.available) * 100), 0, 100) : 0;
    const pointsToGo = Math.max(weeklyPoints.available - weeklyPoints.earned, 0);
    const nextBest = weeklyPoints.sessions
      .filter((session) => !doneKeys.has(sessionCompletionKey(session.date, session.title)))
      .sort((a, b) => getSessionPoints(b) - getSessionPoints(a))[0]
      ?? weeklyPoints.sessions.sort((a, b) => getSessionPoints(b) - getSessionPoints(a))[0];

    return {
      score,
      label: scoreLabel(score, hasTrainingData),
      weeklyPercent,
      pointsThisWeek: weeklyPoints.earned,
      pointsAvailableThisWeek: weeklyPoints.available,
      pointsToGo,
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
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.brand}>TrainGPT</Text>
          <Text style={styles.title}>Training is building you.</Text>
          <Text style={styles.subtitle}>Keep stacking quality points to stay ready for race day.</Text>
        </View>

        <View style={styles.scoreWrap}>
          <View style={styles.scoreRing}>
            <Text style={styles.scoreValue}>{fitness.hasTrainingData ? fitness.score : '—'}</Text>
            <Text style={styles.scoreMax}>/100</Text>
          </View>
          <Text style={styles.scoreLabel}>{fitness.label}</Text>
          <Text style={styles.weekPill}>↑ {fitness.streakBonus || fitness.pointsThisWeek} pts this week</Text>
        </View>
      </View>

      <View style={styles.weekCard}>
        <Text style={styles.kicker}>This week</Text>
        <View style={styles.pointsLine}>
          <Text style={styles.weekPoints}>{fitness.pointsThisWeek}</Text>
          <Text style={styles.weekGoal}>/ {fitness.pointsAvailableThisWeek || 0} pts</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${fitness.weeklyPercent || 3}%` }]} />
        </View>
        <View style={styles.weekMetaRow}>
          <Text style={styles.greenMeta}>{fitness.weeklyPercent}% of weekly goal</Text>
          <Text style={styles.mutedMeta}>{fitness.pointsToGo} pts to go</Text>
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
              <View style={[styles.sportIcon, { backgroundColor: sportTint(session.sport) }]}>
                <Text style={styles.sportIconText}>{sportIcon(session.sport)}</Text>
              </View>
              <View style={styles.sessionCopy}>
                <Text style={styles.sessionTitle}>{cleanTitle(session.title)}</Text>
                <Text style={styles.sessionMeta}>{formatSessionDate(session.date)} · {formatMinutes(session.duration) ?? 'Planned'}</Text>
              </View>
              <Text style={styles.sessionPoints}>+{points} pts</Text>
              <View style={[styles.checkCircle, done ? styles.checkCircleDone : styles.checkCircleEmpty]}>
                <Text style={styles.checkText}>{done ? '✓' : ''}</Text>
              </View>
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
          <View style={[styles.nextIcon, { backgroundColor: sportTint(fitness.nextBest.sport) }]}>
            <Text style={styles.sportIconText}>{sportIcon(fitness.nextBest.sport)}</Text>
          </View>
          <View style={styles.nextCopy}>
            <Text style={styles.kicker}>Next best workout</Text>
            <View style={styles.nextTitleRow}>
              <Text style={styles.nextTitle}>{cleanTitle(fitness.nextBest.title)}</Text>
              <Text style={styles.keyPill}>Key Session</Text>
            </View>
            <Text style={styles.sessionMeta}>{formatMinutes(fitness.nextBest.duration) ?? 'Planned'} · biggest readiness jump</Text>
          </View>
          <View style={styles.nextPointsWrap}>
            <Text style={styles.nextPoints}>+{getSessionPoints(fitness.nextBest)} pts</Text>
            <Text style={styles.chevron}>›</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.momentumCard}>
        <Text style={styles.kicker}>Momentum</Text>
        <View style={styles.momentumGrid}>
          <View style={styles.momentumItem}>
            <Text style={styles.momentumIcon}>♨</Text>
            <Text style={styles.momentumValue}>{fitness.currentSessionStreak}</Text>
            <Text style={styles.momentumLabel}>Day streak</Text>
            <Text style={styles.momentumMeta}>Keep it going</Text>
          </View>
          <View style={styles.momentumDivider} />
          <View style={styles.momentumItem}>
            <Text style={styles.momentumIcon}>◎</Text>
            <Text style={styles.momentumValue}>{fitness.weeklyAdherence || 0}%</Text>
            <Text style={styles.momentumLabel}>Adherence</Text>
            <Text style={styles.momentumMeta}>On track</Text>
          </View>
          <View style={styles.momentumDivider} />
          <View style={styles.momentumItem}>
            <Text style={styles.momentumIcon}>☆</Text>
            <Text style={styles.momentumValue}>+{fitness.streakBonus}</Text>
            <Text style={styles.momentumLabel}>Weekly bonus</Text>
            <Text style={styles.momentumMeta}>Score boost</Text>
          </View>
        </View>
      </View>

      <View style={styles.explainerCard}>
        <View style={styles.bulbIcon}><Text style={styles.bulbText}>i</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.explainerTitle}>How points work</Text>
          <Text style={styles.explainerText}>Higher-value sessions earn more points. Consistency unlocks bonuses. Quality always beats quantity.</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.pageX, paddingTop: 58, paddingBottom: spacing.pageBottom },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 18 },
  headerCopy: { flex: 1, minWidth: 0 },
  brand: { color: colors.ink, fontSize: 18, fontWeight: '900', letterSpacing: -0.6, marginBottom: 20 },
  title: { color: colors.ink, fontSize: 42, lineHeight: 42, fontWeight: '900', letterSpacing: -2.2 },
  subtitle: { marginTop: 14, color: colors.inkSoft, fontSize: 16, lineHeight: 24, fontWeight: '500' },
  scoreWrap: { width: 126, alignItems: 'center', paddingTop: 28 },
  scoreRing: { width: 106, height: 106, borderRadius: 999, borderWidth: 8, borderColor: colors.success, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  scoreValue: { color: colors.ink, fontSize: 38, lineHeight: 40, fontWeight: '900', letterSpacing: -1.6 },
  scoreMax: { color: colors.muted, fontSize: 14, fontWeight: '800' },
  scoreLabel: { marginTop: 7, color: colors.success, fontSize: 15, fontWeight: '900' },
  weekPill: { marginTop: 9, overflow: 'hidden', borderRadius: 999, backgroundColor: colors.successSoft, color: colors.success, paddingHorizontal: 10, paddingVertical: 6, fontSize: 11, fontWeight: '900' },
  weekCard: { marginTop: 28, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 18, ...shadow.card },
  kicker: { color: colors.faint, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.6 },
  pointsLine: { marginTop: 10, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  weekPoints: { color: colors.ink, fontSize: 42, lineHeight: 44, fontWeight: '900', letterSpacing: -1.8 },
  weekGoal: { color: colors.muted, fontSize: 21, lineHeight: 32, fontWeight: '700' },
  progressTrack: { marginTop: 12, height: 9, borderRadius: 999, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: colors.success },
  weekMetaRow: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  greenMeta: { color: colors.success, fontSize: 13, fontWeight: '800' },
  mutedMeta: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  planCard: { marginTop: 14, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 16, ...shadow.card },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  linkText: { color: colors.success, fontSize: 13, fontWeight: '900' },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  sessionDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  sportIcon: { width: 42, height: 42, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  sportIconText: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  sessionCopy: { flex: 1, minWidth: 0 },
  sessionTitle: { color: colors.ink, fontSize: 16, fontWeight: '900', letterSpacing: -0.4 },
  sessionMeta: { marginTop: 3, color: colors.muted, fontSize: 13, fontWeight: '650' },
  sessionPoints: { color: colors.success, fontSize: 14, fontWeight: '900' },
  checkCircle: { width: 28, height: 28, borderRadius: 999, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  checkCircleDone: { borderColor: colors.success, backgroundColor: colors.successSoft },
  checkCircleEmpty: { borderColor: colors.faint, borderStyle: 'dashed' },
  checkText: { color: colors.success, fontSize: 15, fontWeight: '900' },
  emptyState: { paddingVertical: 20 },
  emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  emptyText: { marginTop: 6, color: colors.muted, fontSize: 14, lineHeight: 21 },
  nextCard: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.cream, borderRadius: radius.xl, borderWidth: 1, borderColor: '#eadfd2', padding: 16, ...shadow.card },
  nextIcon: { width: 52, height: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  nextCopy: { flex: 1, minWidth: 0 },
  nextTitleRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  nextTitle: { color: colors.ink, fontSize: 19, fontWeight: '900', letterSpacing: -0.6 },
  keyPill: { overflow: 'hidden', borderRadius: 999, backgroundColor: colors.successSoft, color: colors.success, paddingHorizontal: 8, paddingVertical: 4, fontSize: 11, fontWeight: '900' },
  nextPointsWrap: { alignItems: 'flex-end', gap: 6 },
  nextPoints: { color: colors.success, fontSize: 22, fontWeight: '900', letterSpacing: -0.6 },
  chevron: { color: colors.muted, fontSize: 28, lineHeight: 28, fontWeight: '400' },
  momentumCard: { marginTop: 14, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 16, ...shadow.card },
  momentumGrid: { marginTop: 14, flexDirection: 'row', alignItems: 'stretch' },
  momentumItem: { flex: 1, alignItems: 'center' },
  momentumDivider: { width: 1, backgroundColor: colors.border, marginHorizontal: 8 },
  momentumIcon: { color: colors.success, fontSize: 20, fontWeight: '900' },
  momentumValue: { marginTop: 5, color: colors.ink, fontSize: 24, lineHeight: 26, fontWeight: '900', letterSpacing: -0.8 },
  momentumLabel: { marginTop: 3, color: colors.faint, fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.9, textAlign: 'center' },
  momentumMeta: { marginTop: 4, color: colors.success, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  explainerCard: { marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 16, ...shadow.card },
  bulbIcon: { width: 42, height: 42, borderRadius: 999, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' },
  bulbText: { color: colors.success, fontSize: 18, fontWeight: '900' },
  explainerTitle: { color: colors.ink, fontSize: 16, fontWeight: '900', letterSpacing: -0.4 },
  explainerText: { marginTop: 4, color: colors.muted, fontSize: 13, lineHeight: 19, fontWeight: '600' },
});
