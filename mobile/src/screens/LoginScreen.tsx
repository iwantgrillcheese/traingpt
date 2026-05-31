import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../auth/AuthProvider';

export function LoginScreen() {
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <View style={styles.card}>
        <Text style={styles.kicker}>TrainGPT iOS</Text>
        <Text style={styles.title}>Your training day, without the spreadsheet.</Text>
        <Text style={styles.subtitle}>Sign in with your TrainGPT email account. Apple and Google sign-in come next.</Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder="Email"
          placeholderTextColor="#a1a1aa"
          style={styles.input}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
          placeholder="Password"
          placeholderTextColor="#a1a1aa"
          style={styles.input}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          onPress={submit}
          disabled={loading || !email.trim() || !password}
          style={({ pressed }) => [styles.button, pressed && styles.pressed, (loading || !email.trim() || !password) && styles.disabled]}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fbfaf8', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 32, padding: 24, borderWidth: 1, borderColor: '#e4e4e7' },
  kicker: { color: '#71717a', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.8 },
  title: { marginTop: 14, color: '#09090b', fontSize: 36, lineHeight: 36, fontWeight: '800', letterSpacing: -1.8 },
  subtitle: { marginTop: 14, color: '#71717a', fontSize: 14, lineHeight: 22 },
  input: { marginTop: 14, minHeight: 52, borderRadius: 18, borderWidth: 1, borderColor: '#e4e4e7', backgroundColor: '#fbfbfa', paddingHorizontal: 16, color: '#09090b', fontSize: 16 },
  error: { marginTop: 12, color: '#be123c', fontSize: 13, fontWeight: '700' },
  button: { marginTop: 18, minHeight: 54, borderRadius: 18, backgroundColor: '#09090b', alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  pressed: { transform: [{ scale: 0.99 }] },
});
