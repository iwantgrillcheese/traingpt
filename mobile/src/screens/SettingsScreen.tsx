import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';

export function SettingsScreen() {
  const { user, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>Settings</Text>
      <Text style={styles.title}>Account</Text>
      <Text style={styles.subtitle}>{user?.email ?? 'Signed in'}</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Coming next</Text>
        <Text style={styles.item}>Strava connect status</Text>
        <Text style={styles.item}>Subscription status</Text>
        <Text style={styles.item}>Training zones</Text>
        <Text style={styles.item}>Push reminders</Text>
      </View>

      <Pressable onPress={signOut} style={styles.button}>
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fbfbfa', padding: 20, paddingTop: 72 },
  kicker: { color: '#71717a', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.8 },
  title: { marginTop: 8, color: '#09090b', fontSize: 38, lineHeight: 38, fontWeight: '800', letterSpacing: -1.8 },
  subtitle: { marginTop: 10, color: '#71717a', fontSize: 14, lineHeight: 22 },
  card: { marginTop: 24, backgroundColor: '#fff', borderColor: '#e4e4e7', borderWidth: 1, borderRadius: 24, padding: 20 },
  label: { color: '#a1a1aa', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 },
  item: { color: '#09090b', fontSize: 16, fontWeight: '700', paddingVertical: 10 },
  button: { marginTop: 20, minHeight: 52, borderRadius: 18, backgroundColor: '#09090b', alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontWeight: '800' },
});
