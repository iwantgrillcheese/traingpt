import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, spacing } from '../design/theme';

const prompts = [
  'Explain today’s session',
  'I missed a workout — what now?',
  'How hard should this week feel?',
  'What should I watch out for?',
];

export function CoachScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.kicker}>Coach</Text>
      <Text style={styles.title}>Ask about the work.</Text>
      <Text style={styles.subtitle}>The coach should not feel like a blank chatbot. It should understand your calendar, explain sessions, and help you adjust without overthinking.</Text>

      <View style={styles.heroCard}>
        <Text style={styles.heroKicker}>Native coach</Text>
        <Text style={styles.heroTitle}>Context-first chat is next.</Text>
        <Text style={styles.heroText}>Once backend auth is patched, this screen will call the existing TrainGPT coaching endpoint with your current plan and selected session context.</Text>
      </View>

      <Text style={styles.sectionTitle}>Useful questions</Text>
      {prompts.map((prompt) => (
        <Pressable key={prompt} style={({ pressed }) => [styles.promptCard, pressed && styles.pressed]}>
          <Text style={styles.promptText}>{prompt}</Text>
          <Text style={styles.promptMeta}>Coming soon</Text>
        </Pressable>
      ))}

      <View style={styles.disabledInput}>
        <Text style={styles.disabledInputText}>Coach chat is waiting on the native API auth bridge.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.pageX, paddingTop: 66, paddingBottom: 132 },
  kicker: { color: colors.faint, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.8 },
  title: { marginTop: 8, color: colors.ink, fontSize: 40, lineHeight: 40, fontWeight: '900', letterSpacing: -1.9 },
  subtitle: { marginTop: 10, color: colors.muted, fontSize: 14, lineHeight: 22 },
  heroCard: { marginTop: 24, backgroundColor: colors.ink, borderRadius: radius.xxl, padding: 22, ...shadow.hero },
  heroKicker: { color: '#a8a29e', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.4 },
  heroTitle: { marginTop: 8, color: colors.surface, fontSize: 28, lineHeight: 30, fontWeight: '900', letterSpacing: -1.2 },
  heroText: { marginTop: 10, color: '#d6d3d1', fontSize: 14, lineHeight: 22, fontWeight: '600' },
  sectionTitle: { marginTop: 28, marginBottom: 10, color: colors.ink, fontSize: 22, fontWeight: '900', letterSpacing: -0.8 },
  promptCard: { marginBottom: 10, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 16, ...shadow.card },
  promptText: { color: colors.ink, fontSize: 17, lineHeight: 23, fontWeight: '900', letterSpacing: -0.4 },
  promptMeta: { marginTop: 6, color: colors.faint, fontSize: 12, fontWeight: '800' },
  disabledInput: { marginTop: 14, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, padding: 16 },
  disabledInputText: { color: colors.muted, fontSize: 13, lineHeight: 20, fontWeight: '700' },
  pressed: { transform: [{ scale: 0.992 }], opacity: 0.94 },
});
