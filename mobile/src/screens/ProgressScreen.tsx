import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import type { CompletedSessionRow, SessionRow } from '../types';
import { currentWeekStats, formatMinutes } from '../utils/training';

export function ProgressScreen() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [completed, setCompleted] = useState<CompletedSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const [{ data: sessionRows }, { data: completedRows }] = await Promise.all([
      supabase.from('sessions').select('id,user_id,plan_id,date,sport,title,duration,details').eq('user_id', user.id).order('date', { ascending: true }).limit(500),
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

  if (loading) return <View style={styles.center}><ActivityIndicator /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <Text style={styles.kicker}>Progress</Text>
      <Text style={styles.title}>This week</Text>
      <Text style={styles.subtitle}>Simple native progress first. Strava-powered fitness trends come after the daily loop is solid.</Text>

      <View style={styles.grid}>
        <View style={styles.card}><Text style={styles.label}>Complete</Text><Text style={styles.value}>{stats.done}/{stats.planned}</Text></View>
        <View style={styles.card}><Text style={styles.label}>Volume</Text><Text style={styles.value}>{formatMinutes(stats.minutes) ?? '—'}</Text></View>
        <View style={styles.card}><Text style={styles.label}>Adherence</Text><Text style={styles.value}>{stats.planned ? `${stats.adherence}%` : '—'}</Text></View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fbfbfa' },
  content: { padding: 20, paddingTop: 72, paddingBottom: 120 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fbfbfa' },
  kicker: { color: '#71717a', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.8 },
  title: { marginTop: 8, color: '#09090b', fontSize: 38, lineHeight: 38, fontWeight: '800', letterSpacing: -1.8 },
  subtitle: { marginTop: 10, color: '#71717a', fontSize: 14, lineHeight: 22 },
  grid: { marginTop: 24, gap: 10 },
  card: { backgroundColor: '#fff', borderColor: '#e4e4e7', borderWidth: 1, borderRadius: 24, padding: 20 },
  label: { color: '#a1a1aa', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2 },
  value: { marginTop: 8, color: '#09090b', fontSize: 34, fontWeight: '900', letterSpacing: -1.5 },
});
