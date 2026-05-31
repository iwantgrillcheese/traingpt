import { useMemo, useState } from 'react';
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
import { apiFetch } from '../lib/api';

type RaceType = 'Sprint' | 'Olympic' | 'Half Ironman (70.3)' | 'Ironman (140.6)';
type Experience = 'Beginner' | 'Intermediate' | 'Advanced';

const raceTypes: RaceType[] = ['Sprint', 'Olympic', 'Half Ironman (70.3)', 'Ironman (140.6)'];
const experiences: Experience[] = ['Beginner', 'Intermediate', 'Advanced'];
const restDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function defaultRaceDate() {
  const date = new Date();
  date.setDate(date.getDate() + 16 * 7);
  return date.toISOString().slice(0, 10);
}

function raceLabel(type: RaceType) {
  if (type === 'Half Ironman (70.3)') return '70.3';
  if (type === 'Ironman (140.6)') return '140.6';
  return type;
}

export function PlanScreen() {
  const { user } = useAuth();
  const [raceType, setRaceType] = useState<RaceType>('Half Ironman (70.3)');
  const [raceDate, setRaceDate] = useState(defaultRaceDate());
  const [experience, setExperience] = useState<Experience>('Intermediate');
  const [maxHours, setMaxHours] = useState('8');
  const [restDay, setRestDay] = useState('Monday');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const projectedWeeks = useMemo(() => {
    const parsed = new Date(`${raceDate}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return null;
    const days = Math.ceil((parsed.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days <= 0) return null;
    return Math.max(1, Math.round(days / 7));
  }, [raceDate]);

  const generatePlan = async () => {
    if (!user?.id) return;

    const hours = Number(maxHours);
    if (!raceDate || !Number.isFinite(hours) || hours <= 0) {
      setError('Enter a valid race date and weekly training hours.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await apiFetch('/api/finalize-plan', {
        method: 'POST',
        body: JSON.stringify({
          raceType,
          raceDate,
          experience,
          maxHours: hours,
          restDay,
          planType: 'triathlon',
          athleteNotes: notes.trim() || undefined,
          twoADaysAllowed: false,
          clientUserId: user.id,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok || payload?.ok === false) {
        setError(payload?.error || 'Could not generate your plan yet. Native auth is still being finalized.');
        return;
      }

      setSuccess('Plan generated. Pull to refresh Today or Schedule.');
    } catch (err) {
      console.error('[PlanScreen] plan generation failed', err);
      setError('Could not reach TrainGPT. The native backend bridge may still need to be patched.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>Plan builder</Text>
        <Text style={styles.title}>Build the calendar.</Text>
        <Text style={styles.subtitle}>A focused native setup for getting from race goal to training week without digging through a giant form.</Text>

        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryLabel}>Current setup</Text>
            <Text style={styles.summaryTitle}>{raceLabel(raceType)} · {experience}</Text>
          </View>
          <View style={styles.summaryStat}>
            <Text style={styles.summaryStatValue}>{projectedWeeks ?? '—'}</Text>
            <Text style={styles.summaryStatLabel}>weeks</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.label}>Race distance</Text>
          <View style={styles.raceGrid}>
            {raceTypes.map((option) => (
              <Pressable key={option} onPress={() => setRaceType(option)} style={[styles.raceOption, raceType === option && styles.optionActive]}>
                <Text style={[styles.raceOptionText, raceType === option && styles.optionTextActive]}>{raceLabel(option)}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.label}>Race date</Text>
          <TextInput value={raceDate} onChangeText={setRaceDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.faint} autoCapitalize="none" style={styles.input} />
          <Text style={styles.help}>Use YYYY-MM-DD for now. We’ll replace this with a native date picker.</Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.label}>Experience</Text>
          <View style={styles.segmentedRow}>
            {experiences.map((option) => (
              <Pressable key={option} onPress={() => setExperience(option)} style={[styles.segment, experience === option && styles.optionActive]}>
                <Text style={[styles.segmentText, experience === option && styles.optionTextActive]}>{option}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.twoColumn}>
          <View style={[styles.sectionCard, styles.flexCard]}>
            <Text style={styles.label}>Weekly hours</Text>
            <TextInput value={maxHours} onChangeText={setMaxHours} keyboardType="decimal-pad" placeholder="8" placeholderTextColor={colors.faint} style={styles.input} />
          </View>
          <View style={[styles.sectionCard, styles.flexCard]}>
            <Text style={styles.label}>Rest day</Text>
            <View style={styles.compactOptions}>
              {restDays.map((option) => (
                <Pressable key={option} onPress={() => setRestDay(option)} style={[styles.compactOption, restDay === option && styles.optionActive]}>
                  <Text style={[styles.compactOptionText, restDay === option && styles.optionTextActive]}>{option.slice(0, 3)}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.label}>Coach notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Travel, injuries, weak disciplines, schedule constraints…"
            placeholderTextColor={colors.faint}
            multiline
            style={[styles.input, styles.textArea]}
          />
        </View>

        {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View> : null}
        {success ? <View style={styles.successBox}><Text style={styles.success}>{success}</Text></View> : null}

        <Pressable disabled={loading} onPress={generatePlan} style={({ pressed }) => [styles.button, pressed && styles.pressed, loading && styles.disabled]}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Generate training plan</Text>}
        </Pressable>

        <Text style={styles.footerNote}>Plan generation may take up to a minute. Keep the app open while TrainGPT builds your calendar.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.pageX, paddingTop: 66, paddingBottom: 132 },
  kicker: { color: colors.faint, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.8 },
  title: { marginTop: 8, color: colors.ink, fontSize: 40, lineHeight: 40, fontWeight: '900', letterSpacing: -1.9 },
  subtitle: { marginTop: 10, color: colors.muted, fontSize: 14, lineHeight: 22 },
  summaryCard: { marginTop: 24, backgroundColor: colors.ink, borderRadius: radius.xxl, padding: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', ...shadow.hero },
  summaryLabel: { color: '#a8a29e', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.4 },
  summaryTitle: { marginTop: 8, color: colors.surface, fontSize: 25, lineHeight: 28, fontWeight: '900', letterSpacing: -1.1 },
  summaryStat: { width: 72, height: 72, borderRadius: 24, backgroundColor: '#1c1917', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#44403c' },
  summaryStatValue: { color: colors.surface, fontSize: 25, fontWeight: '900', letterSpacing: -1 },
  summaryStatLabel: { color: '#a8a29e', fontSize: 10, fontWeight: '800' },
  sectionCard: { marginTop: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: 16, ...shadow.card },
  flexCard: { flex: 1 },
  twoColumn: { flexDirection: 'row', gap: 10 },
  label: { marginBottom: 10, color: colors.inkSoft, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.1 },
  raceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  raceOption: { flexGrow: 1, minWidth: '47%', minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  raceOptionText: { color: colors.inkSoft, fontWeight: '900' },
  segmentedRow: { flexDirection: 'row', gap: 8 },
  segment: { flex: 1, minHeight: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  segmentText: { color: colors.inkSoft, fontSize: 12, fontWeight: '900' },
  optionActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  optionTextActive: { color: colors.surface },
  compactOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  compactOption: { minWidth: 41, minHeight: 38, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  compactOptionText: { color: colors.inkSoft, fontSize: 12, fontWeight: '900' },
  input: { minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: 15, color: colors.ink, fontSize: 16, fontWeight: '700' },
  textArea: { minHeight: 96, paddingTop: 14, textAlignVertical: 'top', fontWeight: '600' },
  help: { marginTop: 8, color: colors.faint, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  errorBox: { marginTop: 14, borderRadius: radius.md, backgroundColor: '#fff1f2', borderWidth: 1, borderColor: '#fecdd3', padding: 13 },
  error: { color: colors.danger, fontWeight: '800', lineHeight: 20 },
  successBox: { marginTop: 14, borderRadius: radius.md, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', padding: 13 },
  success: { color: colors.success, fontWeight: '800', lineHeight: 20 },
  button: { marginTop: 18, minHeight: 58, borderRadius: radius.lg, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', ...shadow.hero },
  buttonText: { color: colors.surface, fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.65 },
  pressed: { transform: [{ scale: 0.992 }], opacity: 0.94 },
  footerNote: { marginTop: 12, color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', fontWeight: '600' },
});
