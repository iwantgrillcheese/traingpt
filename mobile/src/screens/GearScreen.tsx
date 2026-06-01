import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, spacing } from '../design/theme';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { apiFetch, getApiBaseUrl } from '../lib/api';

const settingsRows = [
  { title: 'Training preferences', text: 'Rest day, weekly hours, long ride/run preferences, and pacing units will move here after the launch build is stable.' },
  { title: 'Recovery signals', text: 'Oura and WHOOP readiness signals are planned, but should not block the first iOS test build.' },
];

type StravaState = {
  connected: boolean;
  athleteId: string | null;
  activityCount: number;
  latestActivityDate: string | null;
};

function formatLatestActivity(value: string | null) {
  if (!value) return 'No activities synced yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently synced';
  return `Latest activity ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)}`;
}

export function GearScreen() {
  const { user, signOut } = useAuth();
  const [resettingPlan, setResettingPlan] = useState(false);
  const [loadingStrava, setLoadingStrava] = useState(true);
  const [syncingStrava, setSyncingStrava] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [strava, setStrava] = useState<StravaState>({ connected: false, athleteId: null, activityCount: 0, latestActivityDate: null });

  const loadStrava = useCallback(async () => {
    if (!user?.id) return;
    setLoadingStrava(true);

    const [{ data: profile }, { count }, { data: latestActivity }] = await Promise.all([
      supabase
        .from('profiles')
        .select('strava_access_token,strava_refresh_token,strava_athlete_id')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('strava_activities')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
      supabase
        .from('strava_activities')
        .select('start_date_local,start_date')
        .eq('user_id', user.id)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const typedProfile = profile as { strava_access_token?: string | null; strava_refresh_token?: string | null; strava_athlete_id?: string | number | null } | null;
    const typedLatest = latestActivity as { start_date_local?: string | null; start_date?: string | null } | null;

    setStrava({
      connected: Boolean(typedProfile?.strava_access_token && typedProfile?.strava_refresh_token),
      athleteId: typedProfile?.strava_athlete_id ? String(typedProfile.strava_athlete_id) : null,
      activityCount: count ?? 0,
      latestActivityDate: typedLatest?.start_date_local ?? typedLatest?.start_date ?? null,
    });
    setLoadingStrava(false);
  }, [user?.id]);

  useEffect(() => {
    loadStrava();
  }, [loadStrava]);

  const refresh = async () => {
    setRefreshing(true);
    await loadStrava();
    setRefreshing(false);
  };

  const connectStrava = async () => {
    Alert.alert(
      'Strava setup',
      'Strava connection still uses the web OAuth flow. Connect on web, then return here and tap Sync. We need a native Strava callback before App Store launch.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open web settings', onPress: () => Linking.openURL(`${getApiBaseUrl()}/settings`) },
      ]
    );
  };

  const syncStrava = async () => {
    if (!strava.connected || syncingStrava) return;
    setSyncingStrava(true);
    try {
      const response = await apiFetch('/api/strava_sync', { method: 'POST' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Strava sync failed.');
      await loadStrava();
      Alert.alert('Strava synced', `${payload.inserted ?? 0} new activities imported.`);
    } catch (error) {
      console.error('[Settings] Strava sync failed', error);
      Alert.alert('Sync failed', error instanceof Error ? error.message : 'Could not sync Strava right now.');
    } finally {
      setSyncingStrava(false);
    }
  };

  const resetPlanForTesting = async () => {
    if (!user?.id || resettingPlan) return;

    Alert.alert(
      'Reset plan for testing?',
      'This removes your current mobile plan sessions so you can test onboarding and plan generation again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setResettingPlan(true);
            try {
              const { error: completedError } = await supabase.from('completed_sessions').delete().eq('user_id', user.id);
              if (completedError) console.warn('[Settings] completed reset skipped/failed', completedError);

              const { error: sessionsError } = await supabase.from('sessions').delete().eq('user_id', user.id);
              if (sessionsError) throw sessionsError;

              const { error: plansError } = await supabase.from('plans').delete().eq('user_id', user.id);
              if (plansError) console.warn('[Settings] plan row reset skipped/failed', plansError);

              Alert.alert('Plan reset', 'Sign out and back in, or restart the preview, to re-enter onboarding.');
            } catch (error) {
              console.error('[Settings] reset plan failed', error);
              Alert.alert('Reset failed', 'Could not reset your plan yet. Try again in a moment.');
            } finally {
              setResettingPlan(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <Text style={styles.kicker}>Settings</Text>
      <Text style={styles.title}>Account and app controls.</Text>
      <Text style={styles.subtitle}>Useful actions only. Anything unfinished is marked clearly so we do not ship fake buttons.</Text>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.email?.slice(0, 1).toUpperCase() ?? 'T'}</Text>
        </View>
        <View style={styles.profileCopy}>
          <Text style={styles.profileName}>TrainGPT athlete</Text>
          <Text style={styles.profileEmail}>{user?.email ?? 'Signed in'}</Text>
        </View>
      </View>

      <View style={styles.stravaCard}>
        <View style={styles.stravaHeader}>
          <View>
            <Text style={styles.sectionKicker}>Connected account</Text>
            <Text style={styles.sectionTitle}>Strava</Text>
          </View>
          <Text style={[styles.statusPill, strava.connected ? styles.connectedPill : styles.disconnectedPill]}>{strava.connected ? 'Connected' : 'Needs web setup'}</Text>
        </View>

        {loadingStrava ? (
          <View style={styles.loadingRow}><ActivityIndicator /><Text style={styles.loadingCopy}>Checking Strava…</Text></View>
        ) : (
          <>
            <Text style={styles.sectionText}>{strava.connected ? `${strava.activityCount} activities synced. ${formatLatestActivity(strava.latestActivityDate)}.` : 'Native Strava OAuth is not ready yet. Connect through web settings, then sync here.'}</Text>
            <View style={styles.stravaStatsRow}>
              <View style={styles.stravaStat}><Text style={styles.stravaStatValue}>{strava.activityCount}</Text><Text style={styles.stravaStatLabel}>Activities</Text></View>
              <View style={styles.stravaStat}><Text style={styles.stravaStatValue}>{strava.connected ? 'Auto' : 'Web'}</Text><Text style={styles.stravaStatLabel}>Setup</Text></View>
            </View>
            {strava.connected ? (
              <Pressable onPress={syncStrava} disabled={syncingStrava} style={[styles.primaryAction, syncingStrava && styles.disabledButton]}>
                <Text style={styles.primaryActionText}>{syncingStrava ? 'Syncing…' : 'Sync Strava now'}</Text>
              </Pressable>
            ) : (
              <Pressable onPress={connectStrava} style={styles.primaryAction}>
                <Text style={styles.primaryActionText}>Open web Strava setup</Text>
              </Pressable>
            )}
          </>
        )}
      </View>

      {settingsRows.map((item) => (
        <View key={item.title} style={styles.itemCard}>
          <Text style={styles.itemTitle}>{item.title}</Text>
          <Text style={styles.itemText}>{item.text}</Text>
        </View>
      ))}

      <View style={styles.sectionCard}>
        <Text style={styles.sectionKicker}>Developer testing</Text>
        <Text style={styles.sectionTitle}>Retest plan generation</Text>
        <Text style={styles.sectionText}>Clears your plan, sessions, and completed sessions so the app falls back into onboarding.</Text>
        <Pressable onPress={resetPlanForTesting} disabled={resettingPlan} style={[styles.dangerButton, resettingPlan && styles.disabledButton]}>
          <Text style={styles.dangerButtonText}>{resettingPlan ? 'Resetting…' : 'Reset plan for testing'}</Text>
        </Pressable>
      </View>

      <Pressable onPress={signOut} style={styles.signOutButton}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.pageX, paddingTop: 64, paddingBottom: 132 },
  kicker: { color: colors.faint, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.8 },
  title: { marginTop: 12, color: colors.ink, fontSize: 40, lineHeight: 41, fontWeight: '900', letterSpacing: -2 },
  subtitle: { marginTop: 14, color: colors.inkSoft, fontSize: 16, lineHeight: 25, fontWeight: '500' },
  profileCard: { marginTop: 28, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.ink, borderRadius: radius.xl, padding: 18, ...shadow.hero },
  avatar: { width: 58, height: 58, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.ink, fontSize: 23, fontWeight: '900' },
  profileCopy: { flex: 1, marginLeft: 14 },
  profileName: { color: colors.surface, fontSize: 22, fontWeight: '900', letterSpacing: -0.7 },
  profileEmail: { marginTop: 4, color: '#d4d4d8', fontSize: 13, lineHeight: 18, fontWeight: '700' },
  stravaCard: { marginTop: 18, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 18, ...shadow.card },
  stravaHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  statusPill: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, fontSize: 12, fontWeight: '900' },
  connectedPill: { backgroundColor: colors.successSoft, color: colors.success },
  disconnectedPill: { backgroundColor: colors.surfaceMuted, color: colors.muted },
  loadingRow: { marginTop: 14, flexDirection: 'row', gap: 10, alignItems: 'center' },
  loadingCopy: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  stravaStatsRow: { marginTop: 14, flexDirection: 'row', gap: 10 },
  stravaStat: { flex: 1, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, padding: 13 },
  stravaStatValue: { color: colors.ink, fontSize: 24, fontWeight: '900', letterSpacing: -0.9 },
  stravaStatLabel: { marginTop: 4, color: colors.muted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.9 },
  primaryAction: { marginTop: 16, minHeight: 52, borderRadius: radius.md, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  primaryActionText: { color: colors.surface, fontSize: 14, fontWeight: '900' },
  itemCard: { marginTop: 12, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 18, ...shadow.card },
  itemTitle: { color: colors.ink, fontSize: 20, fontWeight: '900', letterSpacing: -0.7 },
  itemText: { marginTop: 8, color: colors.muted, fontSize: 14, lineHeight: 22, fontWeight: '600' },
  sectionCard: { marginTop: 18, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 18, ...shadow.card },
  sectionKicker: { color: colors.faint, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 },
  sectionTitle: { marginTop: 10, color: colors.ink, fontSize: 24, lineHeight: 28, fontWeight: '900', letterSpacing: -0.8 },
  sectionText: { marginTop: 8, color: colors.muted, fontSize: 14, lineHeight: 22, fontWeight: '600' },
  dangerButton: { marginTop: 16, minHeight: 52, borderRadius: radius.md, backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fecaca', alignItems: 'center', justifyContent: 'center' },
  disabledButton: { opacity: 0.6 },
  dangerButtonText: { color: colors.danger, fontSize: 14, fontWeight: '900' },
  signOutButton: { marginTop: 14, minHeight: 54, borderRadius: radius.md, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  signOutText: { color: colors.surface, fontSize: 15, fontWeight: '900' },
});
