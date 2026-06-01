import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, radius, shadow, spacing } from '../design/theme';
import { useAuth } from '../auth/AuthProvider';

export function LoginScreen() {
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);
    const result = await signInWithEmail(email.trim(), password);
    if (result.error) setError(result.error);
    setLoading(false);
  };

  const continueWithGoogle = async () => {
    setGoogleLoading(true);
    setError(null);
    const result = await signInWithGoogle();
    if (result.error) setError(result.error);
    setGoogleLoading(false);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.navRow}>
          <Text style={styles.brand}>TrainGPT</Text>
          <Text style={styles.badge}>Native preview</Text>
        </View>

        <View style={styles.heroBlock}>
          <Text style={styles.kicker}>AI triathlon coaching</Text>
          <Text style={styles.title}>Train with a plan that understands the work.</Text>
          <Text style={styles.subtitle}>Generate a race plan, complete workouts, bank points, and build your Fitness Score.</Text>
        </View>

        <View style={styles.previewCard}>
          <View style={styles.previewTopRow}>
            <Text style={styles.previewLabel}>Weekly mission</Text>
            <Text style={styles.previewMeta}>+220 pts</Text>
          </View>
          <Text style={styles.previewTitle}>Your first training week, scored.</Text>
          <Text style={styles.previewText}>Key sessions earn more. Consistency raises your readiness.</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Sign in</Text>
          <Text style={styles.formSubtitle}>Use Google to access your TrainGPT plan, Strava sync, and training history.</Text>

          <Pressable
            onPress={continueWithGoogle}
            disabled={googleLoading || loading}
            style={({ pressed }) => [styles.googleButton, pressed && styles.pressed, (googleLoading || loading) && styles.disabled]}
          >
            {googleLoading ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.googleButtonText}>Continue with Google</Text>}
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or email preview login</Text>
            <View style={styles.divider} />
          </View>

          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder="Email"
            placeholderTextColor={colors.faint}
            style={styles.input}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
            placeholder="Password"
            placeholderTextColor={colors.faint}
            style={styles.input}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            onPress={submit}
            disabled={loading || googleLoading || !email.trim() || !password}
            style={({ pressed }) => [styles.button, pressed && styles.pressed, (loading || googleLoading || !email.trim() || !password) && styles.disabled]}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Continue with email</Text>}
          </Pressable>
        </View>

        <Text style={styles.footer}>Google sign-in uses the same Supabase auth infrastructure as the TrainGPT web app.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.pageX, paddingTop: 64, paddingBottom: 40 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: colors.ink, fontSize: 18, fontWeight: '900', letterSpacing: -0.6 },
  badge: { overflow: 'hidden', borderRadius: 999, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, color: colors.muted, paddingHorizontal: 10, paddingVertical: 6, fontSize: 11, fontWeight: '800' },
  heroBlock: { marginTop: 72 },
  kicker: { color: colors.faint, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.7 },
  title: { marginTop: 12, color: colors.ink, fontSize: 42, lineHeight: 42, fontWeight: '900', letterSpacing: -2.2 },
  subtitle: { marginTop: 14, color: colors.muted, fontSize: 16, lineHeight: 24, fontWeight: '600' },
  previewCard: { marginTop: 28, backgroundColor: colors.ink, borderRadius: radius.xxl, padding: 20, ...shadow.hero },
  previewTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewLabel: { color: '#a8a29e', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.4 },
  previewMeta: { color: '#86efac', fontSize: 12, fontWeight: '900' },
  previewTitle: { marginTop: 16, color: colors.surface, fontSize: 25, lineHeight: 28, fontWeight: '900', letterSpacing: -1 },
  previewText: { marginTop: 8, color: '#d6d3d1', fontSize: 14, lineHeight: 21, fontWeight: '600' },
  formCard: { marginTop: 14, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 18, ...shadow.card },
  formTitle: { color: colors.ink, fontSize: 22, fontWeight: '900', letterSpacing: -0.8 },
  formSubtitle: { marginTop: 6, color: colors.muted, fontSize: 13, lineHeight: 20, fontWeight: '600' },
  googleButton: { marginTop: 16, minHeight: 54, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  googleButtonText: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  dividerRow: { marginTop: 16, marginBottom: 2, flexDirection: 'row', alignItems: 'center', gap: 10 },
  divider: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.faint, fontSize: 11, fontWeight: '800' },
  input: { marginTop: 12, minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: 16, color: colors.ink, fontSize: 16, fontWeight: '700' },
  error: { marginTop: 12, color: colors.danger, fontSize: 13, fontWeight: '800' },
  button: { marginTop: 14, minHeight: 54, borderRadius: radius.md, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: colors.surface, fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  pressed: { transform: [{ scale: 0.992 }], opacity: 0.94 },
  footer: { marginTop: 16, color: colors.faint, fontSize: 12, lineHeight: 18, textAlign: 'center', fontWeight: '700' },
});
