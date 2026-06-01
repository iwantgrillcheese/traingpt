import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { colors, radius, shadow, spacing } from '../design/theme';
import type { CompletedSessionRow, SessionRow } from '../types';
import { currentWeekStats, formatMinutes } from '../utils/training';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function readinessLabel(score: number) {
  if (score >= 85) return 'Race-ready trajectory';
  if (score >= 70) return 'Building well';
  if (score >= 55) return 'Needs consistency';
  return 'Foundation phase';
}

function readinessCopy(score: number) {
  if (score >= 85) return 'You are stacking the work that matters. Keep recovery protected and avoid turning easy days into tests.';
  if (score >= 70) return 'You are trending in the right direction. The next jump comes from consistent execution, not hero sessions.';
  if (score >= 55) return 'The plan is still very salvageable. Prioritize showing up for the next few key sessions.';
  return 'You need rhythm before intensity. Nail the easy sessions, then let the harder work come back in.';
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

  const readiness = useMemo(() => {
    const today = startOfToday();
    const planStart = sessions.length ? new Date(`${sessions[0].date}T00:00:00`) : today;
    const planEnd = sessions.length ? new Date(`${sessions[sessions.length - 1].date}T00:00:00`) : today;
    const totalPlanDays = Math.max(1, Math.ceil((planEnd.getTime() - planStart.getTime()) / 86400000));
    const elapsedDays = clamp(Math.ceil((today.getTime() - planStart.getTime()) / 86400000), 0, totalPlanDays);
    const planProgress = Math.round((elapsedDays / totalPlanDays) * 100);

    const completedKeys = new Set(
      completed
        .filter((row) => row.status === 'done')
        .map((row) => `${row.date}-${String(row.session_title ?? '').toLowerCase()}`)
    );

    const plannedToDate = sessions.filter((session) => new Date(`${session.date}T00:00:00`) <= today);
    const doneToDate = plannedToDate.filter((session) => completedKeys.has(`${session.date}-${String(session.title ?? '').toLowerCase()}`));
    const planAdherence = plannedToDate.length ? Math.round((doneToDate.length / plannedToDate.length) * 100) : 0;
    const weeklyAdherence = stats.planned ? stats.adherence : planAdherence;
    const weeklyVolumeScore = stats.planned ? clamp(Math.round((stats.done / stats.planned) * 100), 0, 100) : 0;

    const score = sessions.length
      ? clamp(Math.round(planAdherence * 0.48 + weeklyAdherence * 0.34 + weeklyVolumeScore * 0.18), 1, 99)
      : 0;

    return {
      score,
      label: readinessLabel(score),
      copy: readinessCopy(score),
      planProgress,
      planAdherence,
      weeklyAdherence,
      plannedToDate: plannedToDate.length,
      doneToDate: doneToDate.length,
    };
  }, [completed, sessions, stats.adherence, stats.done, stats.planned]);

  if (loading) return <View style={styles.center}><ActivityIndicator /></View>;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <Text style={styles.kicker}>Race readiness</Text>
      <Text style={styles.title}>How ready are you getting?</Text>
      <Text style={styles.subtitle}>A simple readiness view based on plan progress, week-to-date execution, and consistency to date.</Text>

      <View style={styles.heroCard}>
        <View style={styles.scoreRow}>
          <View style={styles.scoreRing}>
            <Text style={styles.scoreValue}>{readiness.score || '—'}</Text>
            <Text style={styles.scoreLabel}>score</Text>
          </View>
          <View style={styles.scoreCopy}>
            <Text style={styles.heroKicker}>{readiness.label}</Text>
            <Text style={styles.heroText}>{readiness.copy}</Text>
          </View>
        </View>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${readiness.score || 4}%` }]} />
        </View>
      </View>

      <View style={styles.grid}>
        <View style={styles.card}>
          <Text style={styles.label}>This week</Text>
          <Text style={styles.value}>{stats.done}/{stats.planned}</Text>
          <Text style={styles.cardMeta}>sessions complete</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>Volume</Text>
          <Text style={styles.value}>{formatMinutes(stats.minutes) ?? '—'}</Text>
          <Text style={styles.cardMeta}>completed this week</Text>
        </View>
      </View>

      <View style={styles.cardLarge}>
        <Text style={styles.label}>Plan-to-date</Text>
        <Text style={styles.bigValue}>{readiness.planAdherence || 0}%</Text>
        <Text style={styles.cardMeta}>{readiness.doneToDate}/{readiness.plannedToDate} assigned sessions banked so far.</Text>
      </View>

      <View style={styles.cardLargeSoft}>
        <Text style={styles.label}>Race build progress</Text>
        <Text style={styles.bigValue}>{readiness.planProgress}%</Text>
        <Text style={styles.cardMeta}>How far you are through the current plan timeline.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.pageX, paddingTop: spacing.pageTop, paddingBottom: spacing.pageBottom },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  kicker: { color: colors.faint, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.8 },
  title: { marginTop: 12, color: colors.ink, fontSize: 40, lineHeight: 41, fontWeight: '900', letterSpacing: -2 },
  subtitle: { marginTop: 14, color: colors.inkSoft, fontSize: 16, lineHeight: 25, fontWeight: '500' },
  heroCard: { marginTop: 28, backgroundColor: colors.ink, borderRadius: radius.xxl, padding: 20, ...shadow.hero },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  scoreRing: { width: 112, height: 112, borderRadius: 999, borderWidth: 9, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  scoreValue: { color: colors.surface, fontSize: 40, lineHeight: 42, fontWeight: '900', letterSpacing: -1.8 },
  scoreLabel: { marginTop: -2, color: '#a1a1aa', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2 },
  scoreCopy: { flex: 1 },
  heroKicker: { color: colors.surface, fontSize: 22, lineHeight: 25, fontWeight: '900', letterSpacing: -0.8 },
  heroText: { marginTop: 8, color: '#d4d4d8', fontSize: 14, lineHeight: 21, fontWeight: '650' },
  progressBarTrack: { marginTop: 20, height: 9, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 999, backgroundColor: colors.surface },
  grid: { marginTop: 14, flexDirection: 'row', gap: 12 },
  card: { flex: 1, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: 16, ...shadow.card },
  cardLarge: { marginTop: 12, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.xl, padding: 20, ...shadow.card },
  cardLargeSoft: { marginTop: 12, backgroundColor: colors.cream, borderColor: colors.border, borderWidth: 1, borderRadius: radius.xl, padding: 20, ...shadow.card },
  label: { color: colors.faint, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.3 },
  value: { marginTop: 8, color: colors.ink, fontSize: 30, fontWeight: '900', letterSpacing: -1.2 },
  bigValue: { marginTop: 8, color: colors.ink, fontSize: 44, lineHeight: 46, fontWeight: '900', letterSpacing: -2 },
  cardMeta: { marginTop: 6, color: colors.muted, fontSize: 13, lineHeight: 20, fontWeight: '650' },
});
