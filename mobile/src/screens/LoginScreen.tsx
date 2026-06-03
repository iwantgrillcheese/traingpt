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
        </View>

        <View style={styles.heroBlock}>
          <Text style={styles.kicker}>Triathlon training, simplified</Text>
          <Text style={styles.title}>Personalized triathlon plans in seconds.</Text>
          <Text style={styles.subtitle}>Create a race-ready plan, follow today’s workout, track progress, and build toward your goal.</Text>
        </View>

        <View style={styles.valueCard}>
          <Text style={styles.valueKicker}>What you get</Text>
          <View style={styles.valueList}>
            <View style={styles.valueRow}>
              <View style={styles.checkDot}><Text style={styles.checkText}>✓</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.valueTitle}>A plan built around your race</Text>
                <Text style={styles.valueText}>Distance, date, experience, weekly hours, and real-life constraints.</Text>
              </View>
            </View>
            <View style={styles.valueRow}>
              <View style={styles.checkDot}><Text style={styles.checkText}>✓</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.valueTitle}>A clear daily workout</Text>
                <Text style={styles.valueText}>Open the app and know exactly what work matters today.</Text>
              </View>
            </View>
            <View style={styles.valueRow}>
              <View style={styles.checkDot}><Text style={styles.checkText}>✓</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.valueTitle}>Race readiness you can build</Text>
                <Text style={styles.valueText}>Complete sessions, bank points, and track whether you are trending toward race day.</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Start training</Text>
          <Text style={styles.formSubtitle}>Sign in to create or access your TrainGPT plan.</Text>

          <Pressable
            onPress={continueWithGoogle}
            disabled={googleLoading || loading}
            style={({ pressed }) => [styles.googleButton, pressed && styles.pressed, (googleLoading || loading) && styles.disabled]}
          >
            {googleLoading ? <ActivityIndicator color={colors.ink} /> : <Text style={styles.googleButtonText}>Continue with Google</Text>}
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or continue with email</Text>
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.pageX, paddingTop: 64, paddingBottom: 40 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: colors.ink, fontSize: 20, fontWeight: '900', letterSpacing: -0.7 },
  heroBlock: { marginTop: 72 },
  kicker: { color: colors.faint, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.7 },
  title: { marginTop: 12, color: colors.ink, fontSize: 43, lineHeight: 44, fontWeight: '900', letterSpacing: -2.2 },
  subtitle: { marginTop: 14, color: colors.muted, fontSize: 17, lineHeight: 26, fontWeight: '600' },
  valueCard: { marginTop: 28, backgroundColor: colors.ink, borderRadius: radius.xxl, padding: 20, ...shadow.hero },
  valueKicker: { color: '#a8a29e', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 },
  valueList: { marginTop: 14, gap: 14 },
  valueRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  checkDot: { width: 26, height: 26, borderRadius: 999, backgroundColor: '#86efac', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  checkText: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  valueTitle: { color: colors.surface, fontSize: 17, lineHeight: 21, fontWeight: '900', letterSpacing: -0.5 },
  valueText: { marginTop: 3, color: '#d6d3d1', fontSize: 13, lineHeight: 19, fontWeight: '600' },
  formCard: { marginTop: 14, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 18, ...shadow.card },
  formTitle: { color: colors.ink, fontSize: 24, fontWeight: '900', letterSpacing: -0.9 },
  formSubtitle: { marginTop: 6, color: colors.muted, fontSize: 14, lineHeight: 21, fontWeight: '600' },
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
});
