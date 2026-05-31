import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, spacing } from '../design/theme';
import { useAuth } from '../auth/AuthProvider';

const rows = [
  { label: 'Strava', value: 'Connect on web for now' },
  { label: 'Subscription', value: 'Plus status coming soon' },
  { label: 'Training zones', value: 'Managed on web' },
  { label: 'Notifications', value: 'Native reminders next' },
];

export function SettingsScreen() {
  const { user, signOut } = useAuth();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.kicker}>Settings</Text>
      <Text style={styles.title}>Account</Text>
      <Text style={styles.subtitle}>{user?.email ?? 'Signed in'}</Text>

      <View style={styles.accountCard}>
        <Text style={styles.accountKicker}>TrainGPT mobile</Text>
        <Text style={styles.accountTitle}>Early native preview</Text>
        <Text style={styles.accountText}>Core schedule viewing is live. Plan generation, detailed workouts, and coach chat need the native API auth bridge before they fully work.</Text>
      </View>

      <View style={styles.listCard}>
        {rows.map((row, index) => (
          <View key={row.label} style={[styles.row, index !== rows.length - 1 && styles.rowBorder]}>
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Text style={styles.rowValue}>{row.value}</Text>
          </View>
        ))}
      </View>

      <Pressable onPress={signOut} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.pageX, paddingTop: 66, paddingBottom: 132 },
  kicker: { color: colors.faint, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.8 },
  title: { marginTop: 8, color: colors.ink, fontSize: 40, lineHeight: 40, fontWeight: '900', letterSpacing: -1.9 },
  subtitle: { marginTop: 10, color: colors.muted, fontSize: 14, lineHeight: 22 },
  accountCard: { marginTop: 24, backgroundColor: colors.ink, borderRadius: radius.xxl, padding: 22, ...shadow.hero },
  accountKicker: { color: '#a8a29e', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.4 },
  accountTitle: { marginTop: 8, color: colors.surface, fontSize: 28, lineHeight: 30, fontWeight: '900', letterSpacing: -1.2 },
  accountText: { marginTop: 10, color: '#d6d3d1', fontSize: 14, lineHeight: 22, fontWeight: '600' },
  listCard: { marginTop: 14, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.xl, paddingHorizontal: 16, ...shadow.card },
  row: { paddingVertical: 16 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { color: colors.ink, fontSize: 16, fontWeight: '900', letterSpacing: -0.3 },
  rowValue: { marginTop: 4, color: colors.muted, fontSize: 13, fontWeight: '700' },
  button: { marginTop: 18, minHeight: 56, borderRadius: radius.lg, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', ...shadow.hero },
  buttonText: { color: colors.surface, fontWeight: '900', fontSize: 15 },
  pressed: { transform: [{ scale: 0.992 }], opacity: 0.94 },
});
