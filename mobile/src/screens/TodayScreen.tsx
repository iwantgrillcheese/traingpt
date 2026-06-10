import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow, spacing, typography } from '../design/theme';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import type { CompletedSessionRow, PlanRow, SessionRow, StravaActivityRow } from '../types';
import { SessionCard } from '../components/SessionCard';
import { SessionDetailSheet } from '../components/SessionDetailSheet';
import { CoachUpdateCard } from '../components/CoachUpdateCard';
import { cleanTitle, formatDay, formatMinutes, getNextSession, getTodaysSessions, normalizeSport } from '../utils/training';
import { getActiveWeekReferenceDate, getSessionPoints, getWeeklyPointStats } from '../utils/sessionPoints';
import { sessionHasSameDayStravaMatch } from '../utils/stravaMatching';

function formatToday() {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function isFutureSession(date?: string | null) {
  if (!date) return false;
  const sessionDate = new Date(`${date}T00:00:00`);
  return sessionDate > startOfToday();
}

function weeksToRace(plan?: PlanRow | null) {
  const raceDate = plan?.race_date ?? plan?.plan?.raceDate ?? plan?.plan?.race_date;
  if (!raceDate) return null;
  const race = new Date(`${raceDate}T00:00:00`);
  if (Number.isNaN(race.getTime())) return null;
  const days = Math.ceil((race.getTime() - startOfToday().getTime()) / 86400000);
  if (days < 0) return 'Race complete';
  if (days < 7) return `${days} days to race day`;
  return `${Math.ceil(days / 7)} weeks to race day`;
}

function isRestSession(session?: SessionRow | null) {
  if (!session) return false;
  const sport = normalizeSport(session.sport);
  const text = `${session.title ?? ''} ${session.details ?? ''}`.toLowerCase();
  return sport === 'Rest' || text.includes('rest day') || text === 'rest' || text.includes('recovery day');
}

function cleanGoalText(session?: SessionRow | null) {
  const raw = session?.details?.replace(/Purpose:|Workout:|Intensity:/gi, '').trim();
  if (raw) return raw;
  return 'Complete the work calmly. Bank the points. Keep the week moving.';
}

function restGoalText(session?: SessionRow | null) {
  const raw = session?.details?.replace(/Purpose:|Workout:|Intensity:/gi, '').trim();
  if (raw) return raw;
  return 'Recharge, keep stress low, and let the work absorb. Optional: 10–15 minutes of easy mobility, light stretching, or a relaxed walk.';
}

export function TodayScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [completed, setCompleted] = useState<CompletedSessionRow[]>([]);
  const [stravaActivities, setStravaActivities] = useState<StravaActivityRow[]>([]);
  const [plan, setPlan] = useState<PlanRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<SessionRow | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setError(null);

    const [{ data: sessionRows, error: sessionError }, { data: completedRows, error: completedError }, { data: stravaRows }, { data: planRows }] = await Promise.all([
      supabase.from('sessions').select('id,user_id,plan_id,date,sport,title,duration,details,structured_workout').eq('user_id', user.id).order('date', { ascending: true }).limit(500),
      supabase.from('completed_sessions').select('id,user_id,date,session_title,status').eq('user_id', user.id),
      supabase.from('strava_activities').select('id,user_id,strava_id,name,sport_type,start_date,start_date_local,moving_time,distance').eq('user_id', user.id).order('start_date', { ascending: false }).limit(120),
      supabase.from('plans').select('id,user_id,race_type,race_date,plan').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1),
    ]);

    if (sessionError || completedError) {
      setError(sessionError?.message ?? completedError?.message ?? 'Could not load training data.');
    }

    setSessions((sessionRows ?? []) as SessionRow[]);
    setCompleted((completedRows ?? []) as CompletedSessionRow[]);
    setStravaActivities((stravaRows ?? []) as StravaActivityRow[]);
    setPlan(((planRows ?? []) as PlanRow[])[0] ?? null);
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
  const todayRestSession = todaysSessions.find(isRestSession) ?? null;
  const heroSession = todayRestSession ?? todaysSessions.find((session) => !isRestSession(session)) ?? nextSession;
  const activeWeekDate = useMemo(() => getActiveWeekReferenceDate(sessions), [sessions]);
  const pointStats = useMemo(() => getWeeklyPointStats(sessions, completed, activeWeekDate), [sessions, completed, activeWeekDate]);
  const heroPoints = heroSession ? getSessionPoints(heroSession) : 0;
  const heroViaStrava = heroSession ? sessionHasSameDayStravaMatch(heroSession, stravaActivities) : false;
  const raceCountdown = weeksToRace(plan);
  const isToday = Boolean(todaysSessions.length);
  const heroIsRest = isRestSession(heroSession);
  const upcoming = useMemo(
    () => sessions.filter((session) => new Date(`${session.date}T00:00:00`) >= startOfToday() && session.id !== heroSession?.id).slice(0, 3),
    [heroSession?.id, sessions]
  );

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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.loadingText}>Opening today’s workout...</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 22 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.brand}>TrainGPT</Text>
          <Text style={styles.date}>{formatToday()}</Text>
          <Text style={styles.title}>{heroIsRest ? 'Rest up today' : isToday ? 'Do this today' : 'Up next'}</Text>
          <Text style={styles.subtitle}>{heroIsRest ? 'Recovery is part of the plan. Take the easy day seriously.' : raceCountdown ?? 'Your daily training work, simplified.'}</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <CoachUpdateCard />

        {heroSession ? (
          <Pressable onPress={() => setSelectedSession(heroSession)} style={({ pressed }) => [styles.heroCard, heroViaStrava && styles.stravaHero, heroIsRest && styles.restHero, pressed && styles.pressedCard]}>
            <View style={styles.heroTopRow}>
              <Text style={styles.kicker}>{heroIsRest ? 'Recovery day' : isToday ? 'Today’s workout' : formatDay(heroSession.date)}</Text>
              <Text style={[styles.pointsPill, heroViaStrava && styles.stravaPill, heroIsRest && styles.restPill]}>{heroIsRest ? 'Recharge' : heroViaStrava ? 'Synced via Strava' : `+${heroPoints} pts`}</Text>
            </View>

            <Text style={styles.sessionTitle} numberOfLines={2} ellipsizeMode="tail">
              {heroIsRest ? 'Rest and recharge' : cleanTitle(heroSession.title)}
            </Text>

            <View style={styles.metaRow}>
              {heroIsRest ? <Text style={styles.metaText}>Optional mobility</Text> : formatMinutes(heroSession.duration) ? <Text style={styles.metaText}>{formatMinutes(heroSession.duration)}</Text> : null}
              <Text style={styles.metaText}>{heroIsRest ? 'Recovery' : normalizeSport(heroSession.sport)}</Text>
              {!heroIsRest ? <Text style={styles.metaText}>{heroPoints} points available</Text> : null}
            </View>

            <View style={styles.goalBox}>
              <Text style={styles.goalLabel}>{heroIsRest ? 'Recovery focus' : 'Goal'}</Text>
              <Text style={styles.goalText} numberOfLines={3} ellipsizeMode="tail">
                {heroIsRest ? restGoalText(heroSession) : cleanGoalText(heroSession)}
              </Text>
            </View>

            <View style={styles.primaryButton}>
              <Text style={styles.primaryText}>{heroIsRest ? 'Open recovery notes' : 'Open workout'}</Text>
            </View>
          </Pressable>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No workout today</Text>
            <Text style={styles.emptyText}>Enjoy the lighter day. Your next session will appear here when it’s ready.</Text>
          </View>
        )}

        <View style={styles.weekCard}>
          <Text style={styles.weekKicker}>This week</Text>
          <View style={styles.weekRow}>
            <Text style={styles.weekPoints}>{pointStats.earned}</Text>
            <Text style={styles.weekGoal}>/ {pointStats.available || 0} pts</Text>
          </View>
          <Text style={styles.weekText}>{heroIsRest ? 'Recover well today, then keep stacking points when training resumes.' : 'Bank today’s workout to move your Race Readiness.'}</Text>
        </View>

        {upcoming.length ? (
          <View style={styles.nextSection}>
            <Text style={styles.sectionTitle}>Coming up</Text>
            {upcoming.map((session) => (
              <SessionCard key={session.id} session={session} completed={completed} stravaActivities={stravaActivities} onPress={() => setSelectedSession(session)} />
            ))}
          </View>
        ) : null}
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
  content: { padding: spacing.pageX, paddingBottom: 138 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: 10, color: colors.muted, fontWeight: '600' },
  header: { marginBottom: 20 },
  brand: { color: colors.ink, fontSize: 19, fontWeight: '800', letterSpacing: -0.5 },
  date: { marginTop: 4, color: colors.muted, fontSize: 15, fontWeight: '600' },
  title: { marginTop: 26, color: colors.ink, fontSize: 39, lineHeight: 41, fontWeight: '800', letterSpacing: -1.6 },
  subtitle: { marginTop: 10, color: colors.inkSoft, fontSize: 16, lineHeight: 23, fontWeight: '500' },
  error: { marginBottom: 12, color: colors.danger, fontWeight: '700' },
  heroCard: { backgroundColor: colors.surface, borderRadius: radius.card, borderColor: colors.border, borderWidth: 1, padding: 20, ...shadow.card },
  stravaHero: { borderColor: '#c7d7ef', backgroundColor: '#f8fbff' },
  restHero: { borderColor: colors.border, backgroundColor: colors.cream },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  kicker: { ...typography.kicker, color: colors.faint },
  pointsPill: { overflow: 'hidden', backgroundColor: colors.successSoft, color: colors.success, borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 6, fontSize: 12, fontWeight: '800' },
  stravaPill: { backgroundColor: colors.blueSoft, color: colors.blue },
  restPill: { backgroundColor: colors.warningSoft, color: colors.warning },
  sessionTitle: { marginTop: 16, color: colors.ink, fontSize: 29, lineHeight: 32, fontWeight: '800', letterSpacing: -1.0 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  metaText: { overflow: 'hidden', borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, color: colors.inkSoft, paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, fontWeight: '700' },
  goalBox: { marginTop: 18, borderRadius: radius.card, backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.border, padding: 15 },
  goalLabel: { ...typography.kicker, color: colors.faint },
  goalText: { marginTop: 7, color: colors.inkSoft, fontSize: 15, lineHeight: 22, fontWeight: '500' },
  primaryButton: { marginTop: 18, minHeight: 56, backgroundColor: colors.ink, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: colors.surface, fontWeight: '800', fontSize: 16 },
  pressedCard: { transform: [{ scale: 0.988 }], opacity: 0.9, backgroundColor: '#f4f4f5' },
  emptyCard: { backgroundColor: colors.surface, borderRadius: radius.card, borderColor: colors.border, borderWidth: 1, padding: 24, ...shadow.card },
  emptyTitle: { color: colors.ink, fontSize: 27, lineHeight: 30, fontWeight: '800', letterSpacing: -0.9 },
  emptyText: { marginTop: 10, color: colors.muted, fontSize: 14, lineHeight: 22 },
  weekCard: { marginTop: 14, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.card, padding: 18, ...shadow.card },
  weekKicker: { ...typography.kicker, color: colors.faint },
  weekRow: { marginTop: 10, flexDirection: 'row', alignItems: 'flex-end', gap: 7 },
  weekPoints: { color: colors.ink, fontSize: 34, lineHeight: 36, fontWeight: '800', letterSpacing: -1.2 },
  weekGoal: { color: colors.muted, fontSize: 17, lineHeight: 26, fontWeight: '700' },
  weekText: { marginTop: 8, color: colors.inkSoft, fontSize: 13, lineHeight: 20, fontWeight: '600' },
  nextSection: { marginTop: 28 },
  sectionTitle: { marginBottom: 10, color: colors.ink, fontSize: 21, fontWeight: '800', letterSpacing: -0.6 },
});
