import { useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, shadow, spacing } from '../design/theme';
import { useAuth } from '../auth/AuthProvider';
import { apiFetch } from '../lib/api';

type RaceType = 'Sprint' | 'Olympic' | 'Half Ironman (70.3)' | 'Ironman (140.6)';
type Experience = 'Beginner' | 'Intermediate' | 'Advanced';

type StepKey = 'data' | 'race' | 'fitness' | 'week' | 'history' | 'notes' | 'review';

const raceTypes: RaceType[] = ['Sprint', 'Olympic', 'Half Ironman (70.3)', 'Ironman (140.6)'];
const experiences: Experience[] = ['Beginner', 'Intermediate', 'Advanced'];
const restDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const hourOptions = ['3-5', '6-8', '9-12', '12+'];
const steps: { key: StepKey; label: string }[] = [
  { key: 'data', label: 'Training data' },
  { key: 'race', label: 'Race goal' },
  { key: 'fitness', label: 'Current fitness' },
  { key: 'week', label: 'Training week' },
  { key: 'history', label: 'Training history' },
  { key: 'notes', label: 'Coach notes' },
  { key: 'review', label: 'Review' },
];

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

function parseHours(option: string, fallback: string) {
  if (option === '3-5') return '5';
  if (option === '6-8') return '8';
  if (option === '9-12') return '10';
  if (option === '12+') return '12';
  return fallback;
}

export function PlanScreen() {
  const { user } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);
  const [raceType, setRaceType] = useState<RaceType>('Half Ironman (70.3)');
  const [raceDate, setRaceDate] = useState(defaultRaceDate());
  const [experience, setExperience] = useState<Experience>('Intermediate');
  const [hourBand, setHourBand] = useState('6-8');
  const [maxHours, setMaxHours] = useState('8');
  const [restDay, setRestDay] = useState('Monday');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const step = steps[stepIndex]?.key ?? 'data';

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
      setSuccess('Your plan is ready. Open Today or Schedule and pull to refresh.');
    } catch (err) {
      console.error('[PlanScreen] plan generation failed', err);
      setError('Could not reach TrainGPT. The native backend bridge may still need to be patched.');
    } finally {
      setLoading(false);
    }
  };

  const continueStep = () => {
    setError(null);
    if (stepIndex < steps.length - 1) setStepIndex((value) => value + 1);
    else generatePlan();
  };

  const backStep = () => {
    setError(null);
    if (stepIndex > 0) setStepIndex((value) => value - 1);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Plan builder</Text>
          <Text style={styles.title}>Rebuild your training plan.</Text>
          <Text style={styles.subtitle}>A guided setup for your race, schedule, training background, and real-world constraints.</Text>
          <View style={styles.stravaPill}><Text style={styles.stravaPillText}>Strava connected · 49 recent activities · 39.8h</Text></View>
        </View>

        <View style={styles.rule} />

        <View style={styles.stepList}>
          {steps.map((item, index) => (
            <Pressable key={item.key} onPress={() => setStepIndex(index)} style={[styles.stepRow, index === stepIndex && styles.stepRowActive]}>
              <Text style={[styles.stepCircle, index === stepIndex && styles.stepCircleActive]}>{index + 1}</Text>
              <View>
                <Text style={[styles.stepSmall, index === stepIndex && styles.stepSmallActive]}>Step {index + 1}</Text>
                <Text style={[styles.stepText, index === stepIndex && styles.stepTextActive]}>{item.label}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <View>
              <Text style={styles.panelStep}>Step {stepIndex + 1}</Text>
              <Text style={styles.panelTitle}>{steps[stepIndex].label}</Text>
            </View>
            <Text style={styles.panelCount}>{stepIndex + 1} / {steps.length}</Text>
          </View>

          {step === 'data' ? (
            <View style={styles.innerCard}>
              <Text style={styles.innerKicker}>Optional</Text>
              <Text style={styles.innerTitle}>Start from your real training history.</Text>
              <Text style={styles.body}>Connect Strava and TrainGPT can use your recent volume, sport balance, and available pace or power data to calibrate the plan. You can skip this and enter details manually.</Text>
              <View style={styles.connectedBox}>
                <Text style={styles.connectedTitle}>Strava connected</Text>
                <Text style={styles.connectedMeta}>49 activities found · 39.8h total · Run/Bike/Swim 14/8/0</Text>
              </View>
            </View>
          ) : null}

          {step === 'race' ? (
            <View style={styles.innerCard}>
              <Text style={styles.innerKicker}>Race</Text>
              <Text style={styles.innerTitle}>What are you training for?</Text>
              <Text style={styles.label}>Race distance</Text>
              <View style={styles.optionGrid}>
                {raceTypes.map((option) => (
                  <Pressable key={option} onPress={() => setRaceType(option)} style={[styles.option, raceType === option && styles.optionActive]}>
                    <Text style={[styles.optionText, raceType === option && styles.optionTextActive]}>{raceLabel(option)}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.label}>Race date</Text>
              <TextInput value={raceDate} onChangeText={setRaceDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.faint} autoCapitalize="none" style={styles.input} />
            </View>
          ) : null}

          {step === 'fitness' ? (
            <View style={styles.innerCard}>
              <Text style={styles.innerKicker}>Current fitness</Text>
              <Text style={styles.innerTitle}>Set the starting level.</Text>
              <View style={styles.segmentedRow}>
                {experiences.map((option) => (
                  <Pressable key={option} onPress={() => setExperience(option)} style={[styles.segment, experience === option && styles.optionActive]}>
                    <Text style={[styles.segmentText, experience === option && styles.optionTextActive]}>{option}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.body}>We’ll add threshold zones after the core onboarding flow feels right.</Text>
            </View>
          ) : null}

          {step === 'week' ? (
            <View style={styles.innerCard}>
              <Text style={styles.innerKicker}>Availability</Text>
              <Text style={styles.innerTitle}>Make the plan fit your week.</Text>
              <Text style={styles.label}>Weekly hours</Text>
              <View style={styles.optionGrid}>
                {hourOptions.map((option) => (
                  <Pressable key={option} onPress={() => { setHourBand(option); setMaxHours(parseHours(option, maxHours)); }} style={[styles.option, hourBand === option && styles.optionActive]}>
                    <Text style={[styles.optionText, hourBand === option && styles.optionTextActive]}>{option}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.label}>Rest day</Text>
              <View style={styles.restGrid}>
                {restDays.map((option) => (
                  <Pressable key={option} onPress={() => setRestDay(option)} style={[styles.restOption, restDay === option && styles.optionActive]}>
                    <Text style={[styles.restText, restDay === option && styles.optionTextActive]}>{option.slice(0, 3)}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {step === 'history' ? (
            <View style={styles.innerCard}>
              <Text style={styles.innerKicker}>Training history</Text>
              <Text style={styles.innerTitle}>Recent pattern</Text>
              <Text style={styles.body}>Strongest signal: consistent bike volume. Gap to improve: swim frequency. The plan should protect key bike and run sessions while nudging sustainable swim exposure.</Text>
              <View style={styles.historyRow}><Text style={styles.historyLabel}>Bike</Text><View style={styles.track}><View style={[styles.fill, { width: '76%' }]} /></View><Text style={styles.historyValue}>18h</Text></View>
              <View style={styles.historyRow}><Text style={styles.historyLabel}>Run</Text><View style={styles.track}><View style={[styles.fill, { width: '48%' }]} /></View><Text style={styles.historyValue}>11h</Text></View>
              <View style={styles.historyRow}><Text style={styles.historyLabel}>Swim</Text><View style={styles.track}><View style={[styles.fill, { width: '16%' }]} /></View><Text style={styles.historyValue}>3h</Text></View>
            </View>
          ) : null}

          {step === 'notes' ? (
            <View style={styles.innerCard}>
              <Text style={styles.innerKicker}>Coach notes</Text>
              <Text style={styles.innerTitle}>Add the constraints a real coach would ask about.</Text>
              <TextInput value={notes} onChangeText={setNotes} placeholder="Travel, injuries, weak disciplines, schedule constraints, long ride preferences..." placeholderTextColor={colors.faint} multiline style={[styles.input, styles.textArea]} />
            </View>
          ) : null}

          {step === 'review' ? (
            <View style={styles.innerCard}>
              <Text style={styles.innerKicker}>Review</Text>
              <Text style={styles.innerTitle}>Ready to build the calendar.</Text>
              <View style={styles.reviewGrid}>
                <View style={styles.reviewItem}><Text style={styles.reviewValue}>{raceLabel(raceType)}</Text><Text style={styles.reviewLabel}>Race</Text></View>
                <View style={styles.reviewItem}><Text style={styles.reviewValue}>{projectedWeeks ?? '—'}</Text><Text style={styles.reviewLabel}>Weeks</Text></View>
                <View style={styles.reviewItem}><Text style={styles.reviewValue}>{maxHours}h</Text><Text style={styles.reviewLabel}>Weekly cap</Text></View>
              </View>
              <Text style={styles.body}>TrainGPT will build a progressive calendar around your race date, training availability, and coach notes.</Text>
            </View>
          ) : null}

          <View style={styles.panelFooter}>
            <Pressable onPress={backStep} disabled={stepIndex === 0} style={[styles.backButton, stepIndex === 0 && styles.disabledBack]}><Text style={styles.backText}>Back</Text></Pressable>
            <Pressable onPress={continueStep} disabled={loading} style={[styles.continueButton, loading && styles.disabled]}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.continueText}>{stepIndex === steps.length - 1 ? 'Generate plan' : 'Continue'}</Text>}</Pressable>
          </View>
        </View>

        {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View> : null}
        {success ? <View style={styles.successBox}><Text style={styles.success}>{success}</Text></View> : null}
        <Text style={styles.footerNote}>This should feel like the same TrainGPT web flow, simplified for mobile.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.pageX, paddingTop: 58, paddingBottom: 132 },
  header: { gap: 0 },
  kicker: { color: colors.faint, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.9 },
  title: { marginTop: 8, color: colors.ink, fontSize: 38, lineHeight: 39, fontWeight: '900', letterSpacing: -1.9 },
  subtitle: { marginTop: 12, color: colors.inkSoft, fontSize: 15, lineHeight: 23, fontWeight: '500' },
  stravaPill: { marginTop: 18, alignSelf: 'flex-start', borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 10 },
  stravaPillText: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  rule: { marginTop: 22, height: 1, backgroundColor: colors.border },
  stepList: { marginTop: 22, gap: 8 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, borderRadius: radius.md, paddingHorizontal: 12 },
  stepRowActive: { backgroundColor: colors.ink },
  stepCircle: { width: 28, height: 28, borderRadius: 999, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.muted, textAlign: 'center', paddingTop: 5, fontSize: 12, fontWeight: '900' },
  stepCircleActive: { color: colors.ink, backgroundColor: colors.surface, borderColor: colors.surface },
  stepSmall: { color: colors.faint, fontSize: 11, fontWeight: '700' },
  stepSmallActive: { color: colors.faint },
  stepText: { marginTop: 1, color: colors.inkSoft, fontSize: 13, fontWeight: '700' },
  stepTextActive: { color: colors.surface, fontWeight: '900' },
  panel: { marginTop: 24, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 18, ...shadow.card },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  panelStep: { color: colors.faint, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.8 },
  panelTitle: { marginTop: 8, color: colors.ink, fontSize: 28, lineHeight: 31, fontWeight: '900', letterSpacing: -1.2 },
  panelCount: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  innerCard: { marginTop: 26, backgroundColor: colors.background, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 18 },
  innerKicker: { color: colors.faint, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.8 },
  innerTitle: { marginTop: 12, color: colors.ink, fontSize: 22, lineHeight: 26, fontWeight: '900', letterSpacing: -0.8 },
  body: { marginTop: 12, color: colors.inkSoft, fontSize: 14, lineHeight: 22, fontWeight: '500' },
  connectedBox: { marginTop: 22, backgroundColor: colors.successSoft, borderRadius: radius.lg, borderWidth: 1, borderColor: '#86efac', padding: 16 },
  connectedTitle: { color: colors.success, fontSize: 15, fontWeight: '900' },
  connectedMeta: { marginTop: 5, color: colors.inkSoft, fontSize: 13, lineHeight: 20, fontWeight: '600' },
  label: { marginTop: 18, marginBottom: 10, color: colors.inkSoft, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.1 },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { flexGrow: 1, minWidth: '47%', minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  optionText: { color: colors.inkSoft, fontWeight: '800' },
  optionActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  optionTextActive: { color: colors.surface },
  input: { minHeight: 54, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 15, color: colors.ink, fontSize: 16, fontWeight: '700' },
  textArea: { minHeight: 136, paddingTop: 14, textAlignVertical: 'top', fontWeight: '600' },
  segmentedRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  segment: { flex: 1, minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  segmentText: { color: colors.inkSoft, fontSize: 12, fontWeight: '800' },
  restGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  restOption: { minWidth: 61, minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  restText: { color: colors.inkSoft, fontWeight: '800' },
  historyRow: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  historyLabel: { width: 48, color: colors.ink, fontWeight: '900' },
  track: { flex: 1, height: 8, borderRadius: 999, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999, backgroundColor: colors.ink },
  historyValue: { width: 34, color: colors.muted, fontSize: 12, fontWeight: '800', textAlign: 'right' },
  reviewGrid: { marginTop: 16, flexDirection: 'row', gap: 8 },
  reviewItem: { flex: 1, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 13 },
  reviewValue: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  reviewLabel: { marginTop: 5, color: colors.muted, fontSize: 11, fontWeight: '800' },
  panelFooter: { marginTop: 28, paddingTop: 18, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', gap: 12 },
  backButton: { minWidth: 84, minHeight: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  disabledBack: { opacity: 0.4 },
  backText: { color: colors.muted, fontWeight: '900' },
  continueButton: { flex: 1, minHeight: 46, borderRadius: radius.md, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  continueText: { color: colors.surface, fontSize: 14, fontWeight: '900' },
  errorBox: { marginTop: 14, borderRadius: radius.md, backgroundColor: '#fff1f2', borderWidth: 1, borderColor: '#fecdd3', padding: 13 },
  error: { color: colors.danger, fontWeight: '800', lineHeight: 20 },
  successBox: { marginTop: 14, borderRadius: radius.md, backgroundColor: colors.successSoft, borderWidth: 1, borderColor: '#bbf7d0', padding: 13 },
  success: { color: colors.success, fontWeight: '800', lineHeight: 20 },
  disabled: { opacity: 0.65 },
  footerNote: { marginTop: 12, color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', fontWeight: '600' },
});
