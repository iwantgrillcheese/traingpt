import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import type { CompletedSessionRow, SessionRow } from '../types';
import { SessionCard } from '../components/SessionCard';
import { formatDay, parseDate } from '../utils/training';

function groupByDate(sessions: SessionRow[]) {
  const groups = new Map<string, SessionRow[]>();
  sessions.forEach((session) => {
    const existing = groups.get(session.date) ?? [];
    existing.push(session);
    groups.set(session.date, existing);
  });
  return Array.from(groups.entries()).sort(([a], [b]) => parseDate(a).getTime() - parseDate(b).getTime());
}

export function ScheduleScreen() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [completed, setCompleted] = useState<CompletedSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const [{ data: sessionRows }, { data: completedRows }] = await Promise.all([
      supabase.from('sessions').select('id,user_id,plan_id,date,sport,title,duration,details,structured_workout').eq('user_id', user.id).order('date', { ascending: true }).limit(500),
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

  const groups = useMemo(() => groupByDate(sessions), [sessions]);

  if (loading) return <View style={styles.center}><ActivityIndicator /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <Text style={styles.kicker}>Schedule</Text>
      <Text style={styles.title}>Training calendar</Text>
      <Text style={styles.subtitle}>Native list-first schedule. Month grid and drag/drop can come later.</Text>

      {groups.map(([date, items]) => (
        <View key={date} style={styles.group}>
          <Text style={styles.date}>{formatDay(date)}</Text>
          {items.map((session) => <SessionCard key={session.id} session={session} completed={completed} />)}
        </View>
      ))}
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
  group: { marginTop: 24 },
  date: { marginBottom: 10, color: '#09090b', fontSize: 20, fontWeight: '800', letterSpacing: -0.7 },
});
