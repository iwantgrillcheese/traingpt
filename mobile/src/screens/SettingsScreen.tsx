import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow, spacing, typography } from '../design/theme';
import { useAuth } from '../auth/AuthProvider';

const rows = [
  { label: 'Strava', value: 'Connect on web for now' },
  { label: 'Subscription', value: 'Plus status coming soon' },
  { label: 'Training zones', value: 'Managed on web' },
  { label: 'Notifications', value: 'Native reminders next' },
];

export function SettingsScreen() {
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 22 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.kicker}>Settings</Text>
      <Text style={styles.title}>Account</Text>
      <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="middle">
        {user?.email ?? 'Signed in'}
      </Text>

      <View style={styles.accountCard}>
        <Text style={styles.accountKicker}>TrainGPT mobile</Text>
        <Text style={styles.accountTitle}>Early native preview</Text>
        <Text style={styles.accountText}>
          Core schedule viewing is live. Plan generation, detailed workouts, and coach chat need the native API auth bridge before they fully work.
        </Text>
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
  content: { padding: spacing.pageX, paddingBottom: 132 },
  kicker: { ...typography.kicker, color: colors.faint },
  title: { marginTop: 8, color: colors.ink, ...typography.title },
  subtitle: { marginTop: 10, color: colors.muted, fontSize: 14, lineHeight: 22, fontWeight: '500' },
  accountCard: { marginTop: 24, backgroundColor: colors.ink, borderRadius: radius.card, padding: 22, ...shadow.hero },
  accountKicker: { ...typography.kicker, color: '#a8a29e' },
  accountTitle: { marginTop: 8, color: colors.surface, fontSize: 25, lineHeight: 28, fontWeight: '800', letterSpacing: -0.9 },
  accountText: { marginTop: 10, color: '#d6d3d1', fontSize: 14, lineHeight: 22, fontWeight: '500' },
  listCard: { marginTop: 14, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.card, paddingHorizontal: 16, ...shadow.card },
  row: { paddingVertical: 16 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { color: colors.ink, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  rowValue: { marginTop: 4, color: colors.muted, fontSize: 13, fontWeight: '600' },
  button: { marginTop: 18, minHeight: 56, borderRadius: radius.card, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', ...shadow.hero },
  buttonText: { color: colors.surface, fontWeight: '800', fontSize: 15 },
  pressed: { transform: [{ scale: 0.992 }], opacity: 0.94 },
});
