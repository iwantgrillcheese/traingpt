import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, spacing } from '../design/theme';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import type { CompletedSessionRow, PlanRow, SessionRow, StravaActivityRow } from '../types';
import { SessionCard } from '../components/SessionCard';
import { SessionDetailSheet } from '../components/SessionDetailSheet';
import { cleanTitle, formatDay, formatMinutes, getNextSession, getTodaysSessions, normalizeSport } from '../utils/training';
import { getActiveWeekReferenceDate, getSessionPoints, getWeeklyPointStats } from '../utils/sessionPoints';
import { sessionHasSameDayStravaMatch } from '../utils/stravaMatching';

function formatToday() {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
}

function weeksToRace(plan?: PlanRow | null) {
  const raceDate = plan?.race_date ?? plan?.plan?.raceDate ?? plan?.plan?.race_date;
  if (!raceDate) return null;
  const race = new Date(`${raceDate}T00:00:00`);
  if (Number.isNaN(race.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.ceil((race.getTime() - today.getTime()) / 86400000);
  if (days < 0) return 'Race complete';
  if (days < 7) return `${days} days to race day`;
  return `${Math.ceil(days / 7)} weeks to race day`;
}

export function TodayScreen() {
  const { user } = useAuth();
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
  const heroSession = todaysSessions[0] ?? nextSession;
  const activeWeekDate = useMemo(() => getActiveWeekReferenceDate(sessions), [sessions]);
  const pointStats = useMemo(() => getWeeklyPointStats(sessions, completed, activeWeekDate), [sessions, completed, activeWeekDate]);
  const heroPoints = heroSession ? getSessionPoints(heroSession) : 0;
  const heroViaStrava = heroSession ? sessionHasSameDayStravaMatch(heroSession, stravaActivities) : false;
  const raceCountdown = weeksToRace(plan);
  const isToday = Boolean(todaysSessions.length);
  const upcoming = useMemo(
    () => sessions.filter((session) => new Date(`${session.date}T00:00:00`) >= new Date(new Date().setHours(0, 0, 0, 0))).slice(isToday ? 1 : 0, isToday ? 3 : 2),
    [isToday, sessions]
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
        <Text style={styles.loadingText}>Opening today’s workout...</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <View style={styles.header}>
          <Text style={styles.brand}>TrainGPT</Text>
          <Text style={styles.date}>{formatToday()}</Text>
          <Text style={styles.title}>{isToday ? 'Do this today.' : 'Up next.'}</Text>
          <Text style={styles.subtitle}>{raceCountdown ?? 'Your daily training work, simplified.'}</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {heroSession ? (
          <Pressable onPress={() => setSelectedSession(heroSession)} style={({ pressed }) => [styles.heroCard, heroViaStrava && styles.stravaHero, pressed && styles.pressed]}>
            <View style={styles.heroTopRow}>
              <Text style={styles.kicker}>{isToday ? 'Today’s workout' : formatDay(heroSession.date)}</Text>
              <Text style={[styles.pointsPill, heroViaStrava && styles.stravaPill]}>{heroViaStrava ? 'Synced via Strava' : `+${heroPoints} pts`}</Text>
            </View>

            <Text style={styles.sessionTitle}>{cleanTitle(heroSession.title)}</Text>

            <View style={styles.metaRow}>
              {formatMinutes(heroSession.duration) ? <Text style={styles.metaText}>{formatMinutes(heroSession.duration)}</Text> : null}
              <Text style={styles.metaText}>{normalizeSport(heroSession.sport)}</Text>
              <Text style={styles.metaText}>{heroPoints} points available</Text>
            </View>

            <View style={styles.goalBox}>
              <Text style={styles.goalLabel}>Goal</Text>
              <Text style={styles.goalText}>{heroSession.details?.replace(/Purpose:|Workout:|Intensity:/gi, '').trim().slice(0, 120) || 'Complete the work calmly. Bank the points. Keep the week moving.'}</Text>
            </View>

            <View style={styles.primaryButton}>
              <Text style={styles.primaryText}>Open workout</Text>
            </View>
          </Pressable>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No workout today.</Text>
            <Text style={styles.emptyText}>Enjoy the lighter day. Your next session will appear here when it’s ready.</Text>
          </View>
        )}

        <View style={styles.weekCard}>
          <Text style={styles.kicker}>This week</Text>
          <View style={styles.weekRow}>
            <Text style={styles.weekPoints}>{pointStats.earned}</Text>
            <Text style={styles.weekGoal}>/ {pointStats.available || 0} pts</Text>
          </View>
          <Text style={styles.weekText}>Bank today’s workout to move your Fitness Score.</Text>
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
  content: { padding: spacing.pageX, paddingTop: 62, paddingBottom: 138 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  loadingText: { marginTop: 10, color: colors.muted, fontWeight: '700' },
  header: { marginBottom: 20 },
  brand: { color: colors.ink, fontSize: 20, fontWeight: '900', letterSpacing: -0.7 },
  date: { marginTop: 4, color: colors.muted, fontSize: 15, fontWeight: '700' },
  title: { marginTop: 28, color: colors.ink, fontSize: 46, lineHeight: 47, fontWeight: '900', letterSpacing: -2.3 },
  subtitle: { marginTop: 10, color: colors.inkSoft, fontSize: 16, lineHeight: 23, fontWeight: '650' },
  error: { marginBottom: 12, color: colors.danger, fontWeight: '800' },
  heroCard: { backgroundColor: colors.surface, borderRadius: radius.xxl, borderColor: colors.border, borderWidth: 1, padding: 20, ...shadow.card },
  stravaHero: { borderColor: '#bfdbfe', backgroundColor: '#f8fbff' },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  kicker: { color: colors.faint, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 },
  pointsPill: { overflow: 'hidden', backgroundColor: colors.successSoft, color: colors.success, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, fontSize: 12, fontWeight: '900' },
  stravaPill: { backgroundColor: colors.blueSoft, color: colors.blue },
  sessionTitle: { marginTop: 16, color: colors.ink, fontSize: 35, lineHeight: 37, fontWeight: '900', letterSpacing: -1.5 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  metaText: { overflow: 'hidden', borderRadius: 999, backgroundColor: colors.surfaceMuted, color: colors.inkSoft, paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, fontWeight: '850' },
  goalBox: { marginTop: 18, borderRadius: radius.lg, backgroundColor: colors.cream, borderWidth: 1, borderColor: '#eadfd2', padding: 15 },
  goalLabel: { color: colors.faint, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.4 },
  goalText: { marginTop: 7, color: colors.inkSoft, fontSize: 15, lineHeight: 23, fontWeight: '600' },
  primaryButton: { marginTop: 18, minHeight: 56, backgroundColor: colors.ink, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: colors.surface, fontWeight: '900', fontSize: 16 },
  pressed: { transform: [{ scale: 0.992 }], opacity: 0.94 },
  emptyCard: { backgroundColor: colors.surface, borderRadius: radius.xxl, borderColor: colors.border, borderWidth: 1, padding: 24, ...shadow.card },
  emptyTitle: { color: colors.ink, fontSize: 30, lineHeight: 32, fontWeight: '900', letterSpacing: -1.3 },
  emptyText: { marginTop: 10, color: colors.muted, fontSize: 14, lineHeight: 22 },
  weekCard: { marginTop: 14, backgroundColor: colors.ink, borderRadius: radius.xl, padding: 18, ...shadow.hero },
  weekRow: { marginTop: 10, flexDirection: 'row', alignItems: 'flex-end', gap: 7 },
  weekPoints: { color: colors.surface, fontSize: 38, lineHeight: 40, fontWeight: '900', letterSpacing: -1.5 },
  weekGoal: { color: '#d4d4d8', fontSize: 19, lineHeight: 29, fontWeight: '800' },
  weekText: { marginTop: 8, color: '#d4d4d8', fontSize: 13, lineHeight: 20, fontWeight: '700' },
  nextSection: { marginTop: 28 },
  sectionTitle: { marginBottom: 10, color: colors.ink, fontSize: 23, fontWeight: '900', letterSpacing: -0.9 },
});
