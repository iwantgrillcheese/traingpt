import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow, spacing, typography } from '../design/theme';
import { useAuth } from '../auth/AuthProvider';
import { apiFetch } from '../lib/api';
import { supabase } from '../lib/supabase';

type StravaStatus = { connected: boolean; activityCount: number; totalHours: number; loading: boolean; };
const rows = [{ label: 'Subscription', value: 'Plus status coming soon' }, { label: 'Training zones', value: 'Managed on web' }, { label: 'Notifications', value: 'Native reminders next' }];

export function SettingsScreen() {
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [strava, setStrava] = useState<StravaStatus>({ connected: false, activityCount: 0, totalHours: 0, loading: true });
  const [disconnecting, setDisconnecting] = useState(false);

  const loadStravaStatus = useCallback(async () => {
    setStrava((current) => ({ ...current, loading: true }));
    try {
      const response = await apiFetch('/api/strava/mobile-status');
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Could not load Strava status.');
      setStrava({ connected: Boolean(payload?.connected), activityCount: Number(payload?.activityCount ?? 0), totalHours: Number(payload?.totalHours ?? 0), loading: false });
    } catch (error) {
      console.error('[SettingsScreen] Strava status failed', error);
      setStrava((current) => ({ ...current, connected: false, loading: false }));
    }
  }, []);

  useEffect(() => { loadStravaStatus(); }, [loadStravaStatus]);

  const [dailyEmail, setDailyEmail] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!user?.id) return;
      const { data } = await supabase.from('profiles').select('daily_email_opt_in').eq('id', user.id).maybeSingle();
      if (active) setDailyEmail(Boolean(data?.daily_email_opt_in));
    })();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const toggleDailyEmail = async (next: boolean) => {
    if (!user?.id) return;
    setDailyEmail(next);
    const { error } = await supabase.from('profiles').update({ daily_email_opt_in: next }).eq('id', user.id);
    if (error) {
      console.error('[SettingsScreen] daily email toggle failed', error);
      setDailyEmail(!next);
    }
  };

  const disconnectStrava = async () => {
    if (disconnecting) return;
    Alert.alert('Disconnect Strava?', 'This removes your Strava connection and clears imported Strava activities from TrainGPT. You can reconnect anytime.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disconnect', style: 'destructive', onPress: async () => {
        setDisconnecting(true);
        try {
          const response = await apiFetch('/api/strava/disconnect', { method: 'POST' });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(payload?.error || 'Could not disconnect Strava.');
          setStrava({ connected: false, activityCount: 0, totalHours: 0, loading: false });
        } catch (error) {
          console.error('[SettingsScreen] Strava disconnect failed', error);
          Alert.alert('Could not disconnect Strava', error instanceof Error ? error.message : 'Try again in a moment.');
        } finally { setDisconnecting(false); }
      } },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + 22 }]} showsVerticalScrollIndicator={false}>
      <Text style={styles.kicker}>Settings</Text>
      <Text style={styles.title}>Account</Text>
      <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="middle">{user?.email ?? 'Signed in'}</Text>
      <View style={styles.accountCard}><Text style={styles.accountKicker}>TrainGPT mobile</Text><Text style={styles.accountTitle}>Early native preview</Text><Text style={styles.accountText}>Core schedule viewing is live. Plan generation, Strava sync, and readiness tracking are improving quickly during TestFlight.</Text></View>
      <View style={styles.stravaCard}>
        <View style={styles.stravaHeader}><View><Text style={styles.rowLabel}>Strava</Text><Text style={styles.rowValue}>{strava.loading ? 'Checking connection...' : strava.connected ? `${strava.activityCount} activities · ${strava.totalHours}h imported` : 'Not connected'}</Text></View>{strava.loading ? <ActivityIndicator /> : null}</View>
        {strava.connected ? <Pressable onPress={disconnectStrava} disabled={disconnecting} style={({ pressed }) => [styles.secondaryButton, disconnecting && styles.disabled, pressed && styles.pressed]}><Text style={styles.secondaryButtonText}>{disconnecting ? 'Disconnecting...' : 'Disconnect Strava'}</Text></Pressable> : <Text style={styles.helperText}>Connect Strava during plan generation to import recent swim, bike, and run history.</Text>}
      </View>
      <View style={styles.listCard}>
        <View style={[styles.row, styles.rowBorder, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowLabel}>Daily session email</Text>
            <Text style={styles.rowValue}>Each morning you have a session — the workout and targets.</Text>
          </View>
          {dailyEmail === null ? (
            <ActivityIndicator />
          ) : (
            <Switch
              value={dailyEmail}
              onValueChange={toggleDailyEmail}
              trackColor={{ false: colors.border, true: colors.ink }}
              thumbColor={colors.surface}
            />
          )}
        </View>{rows.map((row, index) => <View key={row.label} style={[styles.row, index !== rows.length - 1 && styles.rowBorder]}><Text style={styles.rowLabel}>{row.label}</Text><Text style={styles.rowValue}>{row.value}</Text></View>)}</View>
      <Pressable onPress={signOut} style={({ pressed }) => [styles.button, pressed && styles.pressed]}><Text style={styles.buttonText}>Sign out</Text></Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.pageX, paddingBottom: 132 },
  kicker: { ...typography.kicker, color: colors.faint },
  title: { marginTop: 8, color: colors.ink, ...typography.title },
  subtitle: { marginTop: 10, color: colors.muted, fontSize: 14, lineHeight: 22, fontWeight: '500' },
  accountCard: { marginTop: 24, backgroundColor: colors.ink, borderRadius: radius.card, padding: 22, ...shadow.hero },
  accountKicker: { ...typography.kicker, color: '#a8a29e' },
  accountTitle: { marginTop: 8, color: colors.surface, fontSize: 25, lineHeight: 28, fontWeight: '800', letterSpacing: -0.9 },
  accountText: { marginTop: 10, color: '#d6d3d1', fontSize: 14, lineHeight: 22, fontWeight: '500' },
  stravaCard: { marginTop: 14, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.card, padding: 16, ...shadow.card },
  stravaHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  listCard: { marginTop: 14, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.card, paddingHorizontal: 16, ...shadow.card },
  row: { paddingVertical: 16 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { color: colors.ink, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  rowValue: { marginTop: 4, color: colors.muted, fontSize: 13, fontWeight: '600' },
  helperText: { marginTop: 12, color: colors.muted, fontSize: 13, lineHeight: 20, fontWeight: '600' },
  button: { marginTop: 18, minHeight: 56, borderRadius: radius.card, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', ...shadow.hero },
  buttonText: { color: colors.surface, fontWeight: '800', fontSize: 15 },
  secondaryButton: { marginTop: 14, minHeight: 50, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.55 },
  pressed: { transform: [{ scale: 0.992 }], opacity: 0.94 },
});
