import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export function CoachScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>Coach</Text>
      <Text style={styles.title}>Ask about the work.</Text>
      <Text style={styles.subtitle}>Next pass wires this into the existing TrainGPT coaching endpoint with plan and session context.</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Suggested question</Text>
        <Text style={styles.prompt}>What should I focus on for this week of training?</Text>
      </View>

      <TextInput placeholder="Ask your coach…" placeholderTextColor="#a1a1aa" style={styles.input} />
      <Pressable style={styles.button}><Text style={styles.buttonText}>Send</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fbfbfa', padding: 20, paddingTop: 72 },
  kicker: { color: '#71717a', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.8 },
  title: { marginTop: 8, color: '#09090b', fontSize: 38, lineHeight: 38, fontWeight: '800', letterSpacing: -1.8 },
  subtitle: { marginTop: 10, color: '#71717a', fontSize: 14, lineHeight: 22 },
  card: { marginTop: 24, backgroundColor: '#fff', borderColor: '#e4e4e7', borderWidth: 1, borderRadius: 24, padding: 18 },
  label: { color: '#a1a1aa', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2 },
  prompt: { marginTop: 8, color: '#09090b', fontSize: 18, lineHeight: 24, fontWeight: '700' },
  input: { marginTop: 16, minHeight: 54, borderRadius: 18, borderWidth: 1, borderColor: '#e4e4e7', backgroundColor: '#fff', paddingHorizontal: 16, fontSize: 16 },
  button: { marginTop: 10, minHeight: 52, borderRadius: 18, backgroundColor: '#09090b', alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontWeight: '800' },
});
