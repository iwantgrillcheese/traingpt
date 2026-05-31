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

const benefits = [
  'Personalized triathlon plans',
  'Daily sessions built around your race',
  'Coach-style guidance without spreadsheet chaos',
];

export function LoginScreen() {
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);
    const result = await signInWithEmail(email.trim(), password);
    if (result.error) setError(result.error);
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.brandRow}>
          <View style={styles.logoMark}><Text style={styles.logoText}>T</Text></View>
          <Text style={styles.brandText}>TrainGPT</Text>
        </View>

        <View style={styles.heroCard}>
          <Text style={styles.kicker}>AI training plans</Text>
          <Text style={styles.title}>Start training smarter.</Text>
          <Text style={styles.subtitle}>Generate a real training calendar, understand the work, and keep your week moving from your phone.</Text>

          <View style={styles.previewPanel}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewKicker}>Today</Text>
              <Text style={styles.previewTime}>45 min</Text>
            </View>
            <Text style={styles.previewTitle}>Run Easy</Text>
            <Text style={styles.previewText}>Aerobic work. Keep it relaxed, stay smooth, and save the legs for the next key session.</Text>
          </View>
        </View>

        <View style={styles.benefitsCard}>
          {benefits.map((benefit, index) => (
            <View key={benefit} style={[styles.benefitRow, index !== benefits.length - 1 && styles.benefitBorder]}>
              <View style={styles.benefitDot} />
              <Text style={styles.benefitText}>{benefit}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actionsCard}>
          <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Text style={styles.primaryText}>Continue with Apple</Text>
            <Text style={styles.comingSoon}>Coming next</Text>
          </Pressable>

          <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
            <Text style={styles.secondaryText}>Continue with Google</Text>
            <Text style={styles.secondaryMeta}>Coming next</Text>
          </Pressable>

          <Pressable onPress={() => setShowEmailForm((value) => !value)} style={({ pressed }) => [styles.emailToggle, pressed && styles.pressed]}>
            <Text style={styles.emailToggleText}>{showEmailForm ? 'Hide email sign in' : 'Sign in with email'}</Text>
          </Pressable>

          {showEmailForm ? (
            <View style={styles.emailForm}>
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
                disabled={loading || !email.trim() || !password}
                style={({ pressed }) => [styles.submitButton, pressed && styles.pressed, (loading || !email.trim() || !password) && styles.disabled]}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Sign in</Text>}
              </Pressable>
            </View>
          ) : null}
        </View>

        <Text style={styles.footerText}>Native preview. Full Apple and Google sign-in are part of the next auth pass.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.pageX, paddingTop: 64, paddingBottom: 40 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  logoMark: { width: 38, height: 38, borderRadius: 14, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: colors.surface, fontSize: 15, fontWeight: '900' },
  brandText: { color: colors.ink, fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  heroCard: { backgroundColor: colors.ink, borderRadius: radius.xxl, padding: 24, ...shadow.hero },
  kicker: { color: '#a8a29e', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 },
  title: { marginTop: 14, color: colors.surface, fontSize: 44, lineHeight: 43, fontWeight: '900', letterSpacing: -2.3 },
  subtitle: { marginTop: 14, color: '#d6d3d1', fontSize: 15, lineHeight: 23, fontWeight: '600' },
  previewPanel: { marginTop: 24, borderRadius: radius.xl, backgroundColor: '#1c1917', borderWidth: 1, borderColor: '#44403c', padding: 16 },
  previewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  previewKicker: { color: '#a8a29e', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.3 },
  previewTime: { color: '#d6d3d1', fontSize: 12, fontWeight: '900' },
  previewTitle: { marginTop: 12, color: colors.surface, fontSize: 23, fontWeight: '900', letterSpacing: -0.7 },
  previewText: { marginTop: 8, color: '#d6d3d1', fontSize: 13, lineHeight: 20, fontWeight: '600' },
  benefitsCard: { marginTop: 14, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, ...shadow.card },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 15 },
  benefitBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  benefitDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: colors.ink },
  benefitText: { flex: 1, color: colors.ink, fontSize: 15, lineHeight: 20, fontWeight: '800' },
  actionsCard: { marginTop: 14, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 14, ...shadow.card },
  primaryButton: { minHeight: 56, borderRadius: radius.lg, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: colors.surface, fontSize: 15, fontWeight: '900' },
  comingSoon: { marginTop: 2, color: '#a8a29e', fontSize: 10, fontWeight: '800' },
  secondaryButton: { marginTop: 10, minHeight: 56, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  secondaryMeta: { marginTop: 2, color: colors.faint, fontSize: 10, fontWeight: '800' },
  emailToggle: { marginTop: 12, minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  emailToggleText: { color: colors.muted, fontSize: 13, fontWeight: '900' },
  emailForm: { marginTop: 8 },
  input: { marginTop: 10, minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: 16, color: colors.ink, fontSize: 16, fontWeight: '700' },
  error: { marginTop: 12, color: colors.danger, fontSize: 13, fontWeight: '800' },
  submitButton: { marginTop: 12, minHeight: 52, borderRadius: radius.md, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: colors.surface, fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  pressed: { transform: [{ scale: 0.992 }], opacity: 0.94 },
  footerText: { marginTop: 16, color: colors.faint, fontSize: 12, lineHeight: 18, textAlign: 'center', fontWeight: '700' },
});
