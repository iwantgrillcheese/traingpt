import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, spacing } from '../design/theme';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';

const settingsRows = [
  { title: 'Profile', text: 'Manage your account, athlete profile, and onboarding details.' },
  { title: 'Training preferences', text: 'Rest day, weekly hours, long ride/run preferences, and pacing units.' },
  { title: 'Connected accounts', text: 'Strava sync, activity history, and future Garmin/Oura connections.' },
];

export function GearScreen() {
  const { user, signOut } = useAuth();
  const [resettingPlan, setResettingPlan] = useState(false);

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
              const { error: sessionsError } = await supabase.from('sessions').delete().eq('user_id', user.id);
              if (sessionsError) throw sessionsError;

              const { error: plansError } = await supabase.from('plans').delete().eq('user_id', user.id);
              if (plansError) console.warn('[Settings] plan row reset skipped/failed', plansError);

              Alert.alert('Plan reset', 'Close and reopen the app, or sign out and back in, to re-enter onboarding.');
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.kicker}>Settings</Text>
      <Text style={styles.title}>Profile and app controls.</Text>
      <Text style={styles.subtitle}>Manage your athlete profile, training setup, connected accounts, and test tools.</Text>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.email?.slice(0, 1).toUpperCase() ?? 'T'}</Text>
        </View>
        <View style={styles.profileCopy}>
          <Text style={styles.profileName}>TrainGPT athlete</Text>
          <Text style={styles.profileEmail}>{user?.email ?? 'Signed in'}</Text>
        </View>
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
        <Text style={styles.sectionText}>Clears your current plan rows so the app falls back into onboarding. Useful while we are testing the mobile generation flow.</Text>
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
