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

type StepKey = 'data' | 'race' | 'fitness' | 'week' | 'history' | 'notes' | 'review';

const raceTypes: RaceType[] = ['Sprint', 'Olympic', 'Half Ironman (70.3)', 'Ironman (140.6)'];
const experiences: Experience[] = ['Beginner', 'Intermediate', 'Advanced'];
const restDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const hourOptions = ['3–5', '6–8', '9–12', '12+'];
const steps: { key: StepKey; label: string }[] = [
  { key: 'data', label: 'Data' },
  { key: 'race', label: 'Race' },
  { key: 'fitness', label: 'Fitness' },
  { key: 'week', label: 'Week' },
  { key: 'history', label: 'History' },
  { key: 'notes', label: 'Notes' },
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

function stepTitle(step: StepKey) {
  switch (step) {
    case 'data': return 'Start from your real training history.';
    case 'race': return 'Start with your race.';
    case 'fitness': return 'Calibrate the starting point.';
    case 'week': return 'Shape the training week.';
    case 'history': return 'Add recent context.';
    case 'notes': return 'Tell your coach what matters.';
    case 'review': return 'Review your plan setup.';
  }
}

function stepSubtitle(step: StepKey) {
  switch (step) {
    case 'data': return 'Connect recent volume, sport balance, and pace or power context before the plan is built.';
    case 'race': return 'The plan starts with the distance, date, and target you are training toward.';
    case 'fitness': return 'Keep this lightweight for now. We can add threshold zones and deeper inputs after the core loop works.';
    case 'week': return 'Your best plan is only useful if it fits the actual week you live in.';
    case 'history': return 'TrainGPT will use recent consistency and discipline balance as the plan gets smarter.';
    case 'notes': return 'Injuries, travel, weak sports, preferred long ride days, and real constraints belong here.';
    case 'review': return 'This is the final check before TrainGPT builds the calendar.';
  }
}

function parseHours(option: string, fallback: string) {
  if (option === '3–5') return '5';
  if (option === '6–8') return '8';
  if (option === '9–12') return '10';
  if (option === '12+') return '12';
  return fallback;
}

export function PlanScreen() {
  const { user } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);
  const [raceType, setRaceType] = useState<RaceType>('Half Ironman (70.3)');
  const [raceDate, setRaceDate] = useState(defaultRaceDate());
  const [experience, setExperience] = useState<Experience>('Intermediate');
  const [hourBand, setHourBand] = useState('6–8');
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

  const continueStep = () => {
    setError(null);
    if (stepIndex < steps.length - 1) {
      setStepIndex((value) => value + 1);
      return;
    }
    generatePlan();
  };

  const backStep = () => {
    setError(null);
    if (stepIndex > 0) setStepIndex((value) => value - 1);
  };

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

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable onPress={backStep} style={[styles.roundButton, stepIndex === 0 && styles.roundButtonDisabled]}>
            <Text style={styles.roundButtonText}>‹</Text>
          </Pressable>
          <Text style={styles.navTitle}>Plan Builder</Text>
          <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>{stepIndex + 1} / {steps.length}</Text></View>
        </View>

        <View style={styles.progressTrack}>
          {steps.map((item, index) => <View key={item.key} style={[styles.progressSegment, index <= stepIndex && styles.progressSegmentActive]} />)}
        </View>

        <Text style={styles.title}>{stepTitle(step)}</Text>
        <Text style={styles.subtitle}>{stepSubtitle(step)}</Text>

        {step === 'data' ? (
          <View style={styles.stravaCard}>
            <View style={styles.stravaIcon}><Text style={styles.stravaIconText}>A</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stravaTitle}>Strava connected</Text>
              <Text style={styles.stravaMeta}>49 activities · 39.8h total · Run/Bike/Swim 14/8/0</Text>
            </View>
            <Text style={styles.check}>✓</Text>
          </View>
        ) : null}

        <View style={styles.formCard}>
          {step === 'data' ? (
            <>
              <Text style={styles.cardKicker}>Optional</Text>
              <Text style={styles.cardTitle}>Use the athlete’s real training baseline.</Text>
              <Text style={styles.cardText}>For this front-end preview, we’re showing the Strava-connected state. The final version should pull recent activities, summarize consistency, and use this context during generation.</Text>
              <View style={styles.previewStats}>
                <View style={styles.previewStat}><Text style={styles.previewValue}>49</Text><Text style={styles.previewLabel}>Activities</Text></View>
                <View style={styles.previewStat}><Text style={styles.previewValue}>39.8h</Text><Text style={styles.previewLabel}>Volume</Text></View>
                <View style={styles.previewStat}><Text style={styles.previewValue}>14/8/0</Text><Text style={styles.previewLabel}>Run/Bike/Swim</Text></View>
              </View>
            </>
          ) : null}

          {step === 'race' ? (
            <>
              <Text style={styles.label}>Race distance</Text>
              <View style={styles.raceGrid}>
                {raceTypes.map((option) => (
                  <Pressable key={option} onPress={() => setRaceType(option)} style={[styles.raceOption, raceType === option && styles.optionActive]}>
                    <Text style={[styles.raceOptionText, raceType === option && styles.optionTextActive]}>{raceLabel(option)}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[styles.label, styles.labelSpacing]}>Race date</Text>
              <TextInput value={raceDate} onChangeText={setRaceDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.faint} autoCapitalize="none" style={styles.input} />
            </>
          ) : null}

          {step === 'fitness' ? (
            <>
              <Text style={styles.label}>Experience level</Text>
              <View style={styles.segmentedRow}>
                {experiences.map((option) => (
                  <Pressable key={option} onPress={() => setExperience(option)} style={[styles.segment, experience === option && styles.optionActive]}>
                    <Text style={[styles.segmentText, experience === option && styles.optionTextActive]}>{option}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.noteBox}><Text style={styles.noteTitle}>Next pass</Text><Text style={styles.noteText}>Add swim pace, bike FTP, run threshold, and preferred units once the onboarding shape feels right.</Text></View>
            </>
          ) : null}

          {step === 'week' ? (
            <>
              <Text style={styles.label}>Weekly training hours</Text>
              <View style={styles.hourGrid}>
                {hourOptions.map((option) => (
                  <Pressable key={option} onPress={() => { setHourBand(option); setMaxHours(parseHours(option, maxHours)); }} style={[styles.hourOption, hourBand === option && styles.optionActive]}>
                    <Text style={[styles.hourOptionText, hourBand === option && styles.optionTextActive]}>{option}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[styles.label, styles.labelSpacing]}>Preferred rest day</Text>
              <View style={styles.restGrid}>
                {restDays.map((option) => (
                  <Pressable key={option} onPress={() => setRestDay(option)} style={[styles.restOption, restDay === option && styles.optionActive]}>
                    <Text style={[styles.restText, restDay === option && styles.optionTextActive]}>{option.slice(0, 3)}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          {step === 'history' ? (
            <>
              <Text style={styles.cardTitle}>Recent pattern</Text>
              <Text style={styles.cardText}>Strongest signal: consistent bike volume. Gap to improve: swim frequency. Plan should protect key bike/run sessions while nudging sustainable swim exposure.</Text>
              <View style={styles.barRow}><Text style={styles.barLabel}>Bike</Text><View style={styles.barTrack}><View style={[styles.barFill, { width: '76%', backgroundColor: colors.orange }]} /></View><Text style={styles.barValue}>18h</Text></View>
              <View style={styles.barRow}><Text style={styles.barLabel}>Run</Text><View style={styles.barTrack}><View style={[styles.barFill, { width: '48%', backgroundColor: colors.success }]} /></View><Text style={styles.barValue}>11h</Text></View>
              <View style={styles.barRow}><Text style={styles.barLabel}>Swim</Text><View style={styles.barTrack}><View style={[styles.barFill, { width: '16%', backgroundColor: colors.blue }]} /></View><Text style={styles.barValue}>3h</Text></View>
            </>
          ) : null}

          {step === 'notes' ? (
            <>
              <Text style={styles.label}>Coach notes</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Travel, injuries, weak disciplines, schedule constraints, long ride preferences..."
                placeholderTextColor={colors.faint}
                multiline
                style={[styles.input, styles.textArea]}
              />
            </>
          ) : null}

          {step === 'review' ? (
            <>
              <Text style={styles.cardKicker}>Review</Text>
              <Text style={styles.reviewTitle}>{raceLabel(raceType)} · {experience}</Text>
              <View style={styles.reviewGrid}>
                <View style={styles.reviewItem}><Text style={styles.reviewValue}>{projectedWeeks ?? '—'}</Text><Text style={styles.reviewLabel}>Weeks</Text></View>
                <View style={styles.reviewItem}><Text style={styles.reviewValue}>{maxHours}h</Text><Text style={styles.reviewLabel}>Weekly cap</Text></View>
                <View style={styles.reviewItem}><Text style={styles.reviewValue}>{restDay.slice(0, 3)}</Text><Text style={styles.reviewLabel}>Rest day</Text></View>
              </View>
              <Text style={styles.cardText}>TrainGPT will build a progressive calendar around your race date, training availability, and coach notes.</Text>
            </>
          ) : null}
        </View>

        {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View> : null}
        {success ? <View style={styles.successBox}><Text style={styles.success}>{success}</Text></View> : null}

        <Pressable disabled={loading} onPress={continueStep} style={({ pressed }) => [styles.button, pressed && styles.pressed, loading && styles.disabled]}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{stepIndex === steps.length - 1 ? 'Generate training plan' : 'Continue'}</Text>}
        </Pressable>

        <Text style={styles.footerNote}>{stepIndex === steps.length - 1 ? 'Long plans may take up to a minute. Keep the app open while TrainGPT builds your calendar.' : 'You can refine the details later. The goal is a strong first plan, not a perfect questionnaire.'}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.pageX, paddingTop: 62, paddingBottom: 132 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundButton: { width: 44, height: 44, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  roundButtonDisabled: { opacity: 0.35 },
  roundButtonText: { color: colors.ink, fontSize: 30, lineHeight: 32, fontWeight: '400' },
  navTitle: { color: colors.ink, fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  stepBadge: { borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 9 },
  stepBadgeText: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  progressTrack: { marginTop: 24, flexDirection: 'row', gap: 5 },
  progressSegment: { flex: 1, height: 5, borderRadius: 999, backgroundColor: colors.border },
  progressSegmentActive: { backgroundColor: colors.ink },
  title: { marginTop: 36, color: colors.ink, fontSize: 41, lineHeight: 42, fontWeight: '900', letterSpacing: -2.1 },
  subtitle: { marginTop: 12, color: colors.muted, fontSize: 16, lineHeight: 25, fontWeight: '600' },
  stravaCard: { marginTop: 24, flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: colors.successSoft, borderRadius: radius.xl, borderWidth: 1, borderColor: '#86efac', padding: 16, ...shadow.card },
  stravaIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  stravaIconText: { color: colors.orange, fontSize: 22, fontWeight: '900' },
  stravaTitle: { color: colors.success, fontSize: 17, fontWeight: '900', letterSpacing: -0.4 },
  stravaMeta: { marginTop: 3, color: colors.inkSoft, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  check: { color: colors.success, fontSize: 22, fontWeight: '900' },
  formCard: { marginTop: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: 18, ...shadow.card },
  cardKicker: { color: colors.faint, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.6 },
  cardTitle: { marginTop: 12, color: colors.ink, fontSize: 24, lineHeight: 28, fontWeight: '900', letterSpacing: -0.9 },
  cardText: { marginTop: 10, color: colors.muted, fontSize: 14, lineHeight: 22, fontWeight: '600' },
  previewStats: { marginTop: 18, flexDirection: 'row', backgroundColor: colors.surfaceMuted, borderRadius: radius.lg, paddingVertical: 14 },
  previewStat: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  previewValue: { color: colors.ink, fontSize: 20, fontWeight: '900', letterSpacing: -0.8 },
  previewLabel: { marginTop: 5, color: colors.muted, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  label: { marginBottom: 10, color: colors.inkSoft, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.1 },
  labelSpacing: { marginTop: 18 },
  raceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  raceOption: { flexGrow: 1, minWidth: '47%', minHeight: 50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  raceOptionText: { color: colors.inkSoft, fontWeight: '900' },
  segmentedRow: { flexDirection: 'row', gap: 8 },
  segment: { flex: 1, minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  segmentText: { color: colors.inkSoft, fontSize: 12, fontWeight: '900' },
  optionActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  optionTextActive: { color: colors.surface },
  input: { minHeight: 54, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: 15, color: colors.ink, fontSize: 16, fontWeight: '700' },
  textArea: { minHeight: 136, paddingTop: 14, textAlignVertical: 'top', fontWeight: '600' },
  noteBox: { marginTop: 16, borderRadius: radius.lg, backgroundColor: colors.cream, borderWidth: 1, borderColor: '#ead7c2', padding: 15 },
  noteTitle: { color: colors.ink, fontWeight: '900', fontSize: 15 },
  noteText: { marginTop: 6, color: colors.muted, fontSize: 13, lineHeight: 20, fontWeight: '600' },
  hourGrid: { flexDirection: 'row', gap: 8 },
  hourOption: { flex: 1, minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  hourOptionText: { color: colors.inkSoft, fontWeight: '900' },
  restGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  restOption: { minWidth: 62, minHeight: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  restText: { color: colors.inkSoft, fontWeight: '900' },
  barRow: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLabel: { width: 52, color: colors.ink, fontWeight: '900' },
  barTrack: { flex: 1, height: 9, borderRadius: 999, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999 },
  barValue: { width: 36, color: colors.muted, fontSize: 12, fontWeight: '800', textAlign: 'right' },
  reviewTitle: { marginTop: 10, color: colors.ink, fontSize: 30, fontWeight: '900', letterSpacing: -1.2 },
  reviewGrid: { marginTop: 16, flexDirection: 'row', gap: 8 },
  reviewItem: { flex: 1, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted, padding: 14 },
  reviewValue: { color: colors.ink, fontSize: 22, fontWeight: '900' },
  reviewLabel: { marginTop: 5, color: colors.muted, fontSize: 11, fontWeight: '800' },
  errorBox: { marginTop: 14, borderRadius: radius.md, backgroundColor: '#fff1f2', borderWidth: 1, borderColor: '#fecdd3', padding: 13 },
  error: { color: colors.danger, fontWeight: '800', lineHeight: 20 },
  successBox: { marginTop: 14, borderRadius: radius.md, backgroundColor: colors.successSoft, borderWidth: 1, borderColor: '#bbf7d0', padding: 13 },
  success: { color: colors.success, fontWeight: '800', lineHeight: 20 },
  button: { marginTop: 18, minHeight: 60, borderRadius: radius.lg, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', ...shadow.hero },
  buttonText: { color: colors.surface, fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.65 },
  pressed: { transform: [{ scale: 0.992 }], opacity: 0.94 },
  footerNote: { marginTop: 12, color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', fontWeight: '600' },
});
