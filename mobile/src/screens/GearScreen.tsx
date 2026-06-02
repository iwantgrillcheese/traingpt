import { useCallback, useEffect, useState } from 'react';
import * as ExpoLinking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, spacing } from '../design/theme';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';

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

function getQueryParam(url: string, key: string) {
  const queryStart = url.indexOf('?');
  const hashStart = url.indexOf('#');
  const query = queryStart >= 0 ? url.slice(queryStart + 1, hashStart >= 0 ? hashStart : undefined) : '';
  const hash = hashStart >= 0 ? url.slice(hashStart + 1) : '';
  const params = new URLSearchParams(`${query}${query && hash ? '&' : ''}${hash}`);
  return params.get(key);
}

export function GearScreen() {
  const { user, signOut } = useAuth();
  const [resettingPlan, setResettingPlan] = useState(false);
  const [resettingAllData, setResettingAllData] = useState(false);
  const [disconnectingStrava, setDisconnectingStrava] = useState(false);
  const [loadingStrava, setLoadingStrava] = useState(true);
  const [connectingStrava, setConnectingStrava] = useState(false);
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

  const clearPlanData = async () => {
    if (!user?.id) throw new Error('No signed-in user.');

    const { error: completedError } = await supabase.from('completed_sessions').delete().eq('user_id', user.id);
    if (completedError) throw completedError;

    const { error: sessionsError } = await supabase.from('sessions').delete().eq('user_id', user.id);
    if (sessionsError) throw sessionsError;

    const { error: plansError } = await supabase.from('plans').delete().eq('user_id', user.id);
    if (plansError) throw plansError;
  };

  const clearStravaData = async () => {
    if (!user?.id) throw new Error('No signed-in user.');

    const { error: activitiesError } = await supabase.from('strava_activities').delete().eq('user_id', user.id);
    if (activitiesError) throw activitiesError;

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        strava_access_token: null,
        strava_refresh_token: null,
        strava_expires_at: null,
        strava_athlete_id: null,
      })
      .eq('id', user.id);

    if (profileError) throw profileError;
  };

  const connectStrava = async () => {
    if (connectingStrava) return;
    setConnectingStrava(true);

    try {
      const appRedirect = ExpoLinking.createURL('strava/callback');
      const response = await apiFetch('/api/strava/mobile-connect', {
        method: 'POST',
        body: JSON.stringify({ appRedirect }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.url) throw new Error(payload?.error || 'Could not start Strava connection.');

      const result = await WebBrowser.openAuthSessionAsync(payload.url, appRedirect);
      if (result.type === 'success') {
        const success = getQueryParam(result.url, 'success');
        const error = getQueryParam(result.url, 'error');
        if (error) throw new Error(error);
        if (success === 'strava_connected') {
          await loadStrava();
          Alert.alert('Strava connected', 'Your account is connected. Sync now to import recent activities.');
        }
      }
    } catch (error) {
      console.error('[Settings] Strava connect failed', error);
      Alert.alert('Strava connection failed', error instanceof Error ? error.message : 'Could not connect Strava right now.');
    } finally {
      setConnectingStrava(false);
    }
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

  const disconnectStrava = async () => {
    if (!user?.id || disconnectingStrava) return;

    Alert.alert(
      'Disconnect Strava?',
      'This removes your Strava connection and synced activity history from TrainGPT. Your Strava account is not changed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            setDisconnectingStrava(true);
            try {
              await clearStravaData();
              await loadStrava();
              Alert.alert('Strava disconnected', 'Your Strava data has been removed from this account.');
            } catch (error) {
              console.error('[Settings] disconnect Strava failed', error);
              Alert.alert('Disconnect failed', 'Could not disconnect Strava right now.');
            } finally {
              setDisconnectingStrava(false);
            }
          },
        },
      ]
    );
  };

  const resetTrainingPlan = async () => {
    if (!user?.id || resettingPlan) return;

    Alert.alert(
      'Reset training plan?',
      'This removes your current plan, sessions, and completed session history. Your Strava connection and synced activities stay connected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset plan',
          style: 'destructive',
          onPress: async () => {
            setResettingPlan(true);
            try {
              await clearPlanData();
              Alert.alert('Plan reset', 'Restart the app to build a new training plan.');
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

  const resetAllAppData = async () => {
    if (!user?.id || resettingAllData) return;

    Alert.alert(
      'Reset all app data?',
      'This gives this account a clean slate by clearing your plan, sessions, completed sessions, synced Strava activities, and Strava connection.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset all',
          style: 'destructive',
          onPress: async () => {
            setResettingAllData(true);
            try {
              await clearPlanData();
              await clearStravaData();
              await loadStrava();
              Alert.alert('All app data reset', 'Sign out and back in, or restart the app, for a completely clean onboarding experience.');
            } catch (error) {
              console.error('[Settings] reset all data failed', error);
              Alert.alert('Reset failed', 'Could not reset all app data yet. Try again in a moment.');
            } finally {
              setResettingAllData(false);
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
      <Text style={styles.title}>Account and connections.</Text>
      <Text style={styles.subtitle}>Manage sign-in, connected training data, and plan controls.</Text>

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
          <Text style={[styles.statusPill, strava.connected ? styles.connectedPill : styles.disconnectedPill]}>{strava.connected ? 'Connected' : 'Not connected'}</Text>
        </View>

        {loadingStrava ? (
          <View style={styles.loadingRow}><ActivityIndicator /><Text style={styles.loadingCopy}>Checking Strava…</Text></View>
        ) : (
          <>
            <Text style={styles.sectionText}>{strava.connected ? `${strava.activityCount} activities synced. ${formatLatestActivity(strava.latestActivityDate)}.` : 'Connect Strava to import completed activities and match them to your training plan.'}</Text>
            <View style={styles.stravaStatsRow}>
              <View style={styles.stravaStat}><Text style={styles.stravaStatValue}>{strava.activityCount}</Text><Text style={styles.stravaStatLabel}>Activities</Text></View>
              <View style={styles.stravaStat}><Text style={styles.stravaStatValue}>{strava.connected ? 'On' : 'Off'}</Text><Text style={styles.stravaStatLabel}>Sync</Text></View>
            </View>
            {strava.connected ? (
              <View style={styles.actionStack}>
                <Pressable onPress={syncStrava} disabled={syncingStrava} style={({ pressed }) => [styles.primaryAction, syncingStrava && styles.disabledButton, pressed && styles.primaryPressed]}>
                  <Text style={styles.primaryActionText}>{syncingStrava ? 'Syncing…' : 'Sync Strava now'}</Text>
                </Pressable>
                <Pressable onPress={disconnectStrava} disabled={disconnectingStrava} style={({ pressed }) => [styles.secondaryAction, disconnectingStrava && styles.disabledButton, pressed && styles.secondaryPressed]}>
                  <Text style={styles.secondaryActionText}>{disconnectingStrava ? 'Disconnecting…' : 'Disconnect Strava'}</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={connectStrava} disabled={connectingStrava} style={({ pressed }) => [styles.primaryAction, connectingStrava && styles.disabledButton, pressed && styles.primaryPressed]}>
                <Text style={styles.primaryActionText}>{connectingStrava ? 'Connecting…' : 'Connect Strava'}</Text>
              </Pressable>
            )}
          </>
        )}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionKicker}>Plan controls</Text>
        <Text style={styles.sectionTitle}>Start over</Text>
        <Text style={styles.sectionText}>Clear your current plan and build a new one when your race, schedule, or goals change.</Text>
        <Pressable onPress={resetTrainingPlan} disabled={resettingPlan} style={({ pressed }) => [styles.dangerButton, resettingPlan && styles.disabledButton, pressed && styles.dangerPressed]}>
          <Text style={styles.dangerButtonText}>{resettingPlan ? 'Resetting…' : 'Reset training plan'}</Text>
        </Pressable>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionKicker}>Clean slate</Text>
        <Text style={styles.sectionTitle}>Reset all app data</Text>
        <Text style={styles.sectionText}>Use this for a blank test account experience. It clears your plan, completions, synced Strava activities, and Strava connection.</Text>
        <Pressable onPress={resetAllAppData} disabled={resettingAllData} style={({ pressed }) => [styles.dangerButtonStrong, resettingAllData && styles.disabledButton, pressed && styles.dangerStrongPressed]}>
          <Text style={styles.dangerButtonStrongText}>{resettingAllData ? 'Resetting all…' : 'Reset all app data'}</Text>
        </Pressable>
      </View>

      <Pressable onPress={signOut} style={({ pressed }) => [styles.signOutButton, pressed && styles.primaryPressed]}>
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
  actionStack: { marginTop: 16, gap: 10 },
  primaryAction: { marginTop: 16, minHeight: 52, borderRadius: radius.md, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  primaryActionText: { color: colors.surface, fontSize: 14, fontWeight: '900' },
  secondaryAction: { minHeight: 50, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  secondaryActionText: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  sectionCard: { marginTop: 18, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 18, ...shadow.card },
  sectionKicker: { color: colors.faint, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 },
  sectionTitle: { marginTop: 10, color: colors.ink, fontSize: 24, lineHeight: 28, fontWeight: '900', letterSpacing: -0.8 },
  sectionText: { marginTop: 8, color: colors.muted, fontSize: 14, lineHeight: 22, fontWeight: '600' },
  dangerButton: { marginTop: 16, minHeight: 52, borderRadius: radius.md, backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fecaca', alignItems: 'center', justifyContent: 'center' },
  dangerButtonText: { color: colors.danger, fontSize: 14, fontWeight: '900' },
  dangerButtonStrong: { marginTop: 16, minHeight: 52, borderRadius: radius.md, backgroundColor: colors.danger, borderWidth: 1, borderColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  dangerButtonStrongText: { color: colors.surface, fontSize: 14, fontWeight: '900' },
  disabledButton: { opacity: 0.6 },
  primaryPressed: { transform: [{ scale: 0.975 }], opacity: 0.88, backgroundColor: '#27272a' },
  secondaryPressed: { transform: [{ scale: 0.975 }], opacity: 0.88, backgroundColor: colors.surfaceMuted },
  dangerPressed: { transform: [{ scale: 0.975 }], opacity: 0.88, backgroundColor: '#fecaca' },
  dangerStrongPressed: { transform: [{ scale: 0.975 }], opacity: 0.88, backgroundColor: '#9f1239' },
  signOutButton: { marginTop: 14, minHeight: 54, borderRadius: radius.md, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  signOutText: { color: colors.surface, fontSize: 15, fontWeight: '900' },
});
