import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, shadow, spacing } from '../design/theme';
import { useAuth } from '../auth/AuthProvider';
import { apiFetch } from '../lib/api';
import { PlanGenerationExperience } from '../components/PlanGenerationExperience';

type RaceType = 'Sprint' | 'Olympic' | 'Half Ironman (70.3)' | 'Ironman (140.6)';
type Experience = 'Beginner' | 'Intermediate' | 'Advanced';
type StepKey = 'race' | 'date' | 'experience' | 'hours' | 'strava' | 'notes' | 'review';

type PlanScreenProps = {
  onPlanCreated?: () => void;
};

const raceTypes: RaceType[] = ['Sprint', 'Olympic', 'Half Ironman (70.3)', 'Ironman (140.6)'];
const experiences: Experience[] = ['Beginner', 'Intermediate', 'Advanced'];
const hourOptions = ['3-5', '6-8', '9-12', '12+'];
const steps: { key: StepKey; eyebrow: string; title: string; subtitle: string }[] = [
  { key: 'race', eyebrow: 'Step 1', title: 'What are you training for?', subtitle: 'Start with the race distance. TrainGPT will shape the calendar around the demands of the event.' },
  { key: 'date', eyebrow: 'Step 2', title: 'When is race day?', subtitle: 'Your race date controls the length of the build, taper timing, and first-week ramp.' },
  { key: 'experience', eyebrow: 'Step 3', title: 'Where are you starting from?', subtitle: 'Choose the level that best reflects your current training background.' },
  { key: 'hours', eyebrow: 'Step 4', title: 'How many hours can you train?', subtitle: 'Pick a realistic weekly range. A good plan fits your life before it stretches your fitness.' },
  { key: 'strava', eyebrow: 'Step 5', title: 'Connect training history.', subtitle: 'You can connect Strava after your plan is built to match completed activities and improve Race Readiness.' },
  { key: 'notes', eyebrow: 'Step 6', title: 'Any constraints?', subtitle: 'Tell your coach about injuries, travel, weak disciplines, preferred long ride days, or schedule limits.' },
  { key: 'review', eyebrow: 'Step 7', title: 'Ready to build.', subtitle: 'Review the setup. Then TrainGPT will generate the calendar and session structure.' },
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

function parseHours(option: string) {
  if (option === '3-5') return '5';
  if (option === '6-8') return '8';
  if (option === '9-12') return '10';
  if (option === '12+') return '12';
  return '8';
}

function generationSteps() {
  return [
    'Reading your race goal',
    'Balancing swim, bike, and run',
    'Choosing a safe starting load',
    'Placing key sessions on the calendar',
    'Assigning session points',
    'Unlocking Race Readiness',
  ];
}

function progressToStep(progress: number, totalSteps: number) {
  const usableRange = 88;
  const rawStep = Math.floor((Math.min(progress, usableRange) / usableRange) * totalSteps);
  return Math.min(totalSteps - 1, Math.max(0, rawStep));
}

export function PlanScreen({ onPlanCreated }: PlanScreenProps) {
  const { user } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);
  const [raceType, setRaceType] = useState<RaceType>('Half Ironman (70.3)');
  const [raceDate, setRaceDate] = useState(defaultRaceDate());
  const [experience, setExperience] = useState<Experience>('Intermediate');
  const [hourBand, setHourBand] = useState('6-8');
  const [maxHours, setMaxHours] = useState('8');
  const [notes, setNotes] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generationComplete, setGenerationComplete] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const current = steps[stepIndex];
  const step = current.key;
  const magicSteps = generationSteps();

  const projectedWeeks = useMemo(() => {
    const parsed = new Date(`${raceDate}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return null;
    const days = Math.ceil((parsed.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days <= 0) return null;
    return Math.max(1, Math.round(days / 7));
  }, [raceDate]);

  useEffect(() => {
    if (!generating || generationComplete) return undefined;

    const interval = setInterval(() => {
      setGenerationProgress((value) => {
        const increment = value < 25 ? 4 : value < 55 ? 2.5 : value < 78 ? 1.25 : value < 88 ? 0.5 : 0;
        const next = Math.min(90, value + increment);
        setGenerationStep(progressToStep(next, magicSteps.length));
        return next;
      });
    }, 1200);

    return () => clearInterval(interval);
  }, [generating, generationComplete, magicSteps.length]);

  const generatePlan = async () => {
    if (!user?.id) return;
    const hours = Number(maxHours);
    if (!raceDate || !Number.isFinite(hours) || hours <= 0) {
      setError('Enter a valid race date and weekly training hours.');
      return;
    }

    setGenerating(true);
    setGenerationComplete(false);
    setGenerationStep(0);
    setGenerationProgress(4);
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
          restDay: 'Monday',
          planType: 'triathlon',
          athleteNotes: notes.trim() || undefined,
          twoADaysAllowed: false,
          clientUserId: user.id,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.ok === false) {
        setError(payload?.error || 'Could not generate your plan yet.');
        setGenerating(false);
        return;
      }

      setGenerationProgress(100);
      setGenerationStep(magicSteps.length - 1);
      setGenerationComplete(true);
      setSuccess('Your calendar is ready. Opening Schedule...');
      setTimeout(() => {
        setGenerating(false);
        onPlanCreated?.();
      }, 1600);
    } catch (err) {
      console.error('[PlanScreen] plan generation failed', err);
      setError('Could not reach TrainGPT. Try again in a moment.');
      setGenerating(false);
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

  if (generating) {
    return <PlanGenerationExperience currentStep={generationStep} steps={magicSteps} complete={generationComplete} progressPercent={generationProgress} />;
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <Text style={styles.brand}>TrainGPT</Text>
          <Text style={styles.progressText}>{stepIndex + 1} / {steps.length}</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${((stepIndex + 1) / steps.length) * 100}%` }]} />
        </View>

        <Text style={styles.eyebrow}>{current.eyebrow}</Text>
        <Text style={styles.title}>{current.title}</Text>
        <Text style={styles.subtitle}>{current.subtitle}</Text>

        <View style={styles.card}>
          {step === 'race' ? (
            <View style={styles.optionStack}>
              {raceTypes.map((option) => (
                <Pressable key={option} onPress={() => setRaceType(option)} style={({ pressed }) => [styles.largeOption, raceType === option && styles.optionActive, pressed && styles.pressedOption]}>
                  <Text style={[styles.largeOptionText, raceType === option && styles.optionTextActive]}>{raceLabel(option)}</Text>
                  <Text style={[styles.largeOptionMeta, raceType === option && styles.optionTextActive]}>{option}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {step === 'date' ? (
            <View>
              <Text style={styles.label}>Race date</Text>
              <TextInput value={raceDate} onChangeText={setRaceDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.faint} autoCapitalize="none" style={styles.input} />
              <View style={styles.contextBox}><Text style={styles.contextValue}>{projectedWeeks ?? '-'} weeks to build</Text><Text style={styles.contextText}>TrainGPT will build progression, recovery, peak, and taper from this timeline.</Text></View>
            </View>
          ) : null}

          {step === 'experience' ? (
            <View style={styles.optionStack}>
              {experiences.map((option) => (
                <Pressable key={option} onPress={() => setExperience(option)} style={({ pressed }) => [styles.largeOption, experience === option && styles.optionActive, pressed && styles.pressedOption]}>
                  <Text style={[styles.largeOptionText, experience === option && styles.optionTextActive]}>{option}</Text>
                  <Text style={[styles.largeOptionMeta, experience === option && styles.optionTextActive]}>{option === 'Beginner' ? 'Newer to structured triathlon training' : option === 'Intermediate' ? 'Consistent training, building toward performance' : 'Experienced athlete with higher training tolerance'}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {step === 'hours' ? (
            <View style={styles.grid}>
              {hourOptions.map((option) => (
                <Pressable key={option} onPress={() => { setHourBand(option); setMaxHours(parseHours(option)); }} style={({ pressed }) => [styles.tile, hourBand === option && styles.optionActive, pressed && styles.pressedOption]}>
                  <Text style={[styles.tileText, hourBand === option && styles.optionTextActive]}>{option}</Text>
                  <Text style={[styles.tileMeta, hourBand === option && styles.optionTextActive]}>hrs/wk</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {step === 'strava' ? (
            <View>
              <View style={styles.stravaBox}>
                <Text style={styles.stravaStatus}>Optional connection</Text>
                <Text style={styles.stravaBig}>Connect Strava after your plan is built</Text>
                <Text style={styles.stravaMeta}>Completed activities can match to your calendar and feed Race Readiness.</Text>
              </View>
              <Text style={styles.body}>You can build a plan now without Strava. Add training history later from Settings.</Text>
            </View>
          ) : null}

          {step === 'notes' ? (
            <View>
              <Text style={styles.label}>Coach notes</Text>
              <TextInput value={notes} onChangeText={setNotes} placeholder="Travel, injuries, weak disciplines, schedule constraints, long ride preferences..." placeholderTextColor={colors.faint} multiline style={[styles.input, styles.textArea]} />
            </View>
          ) : null}

          {step === 'review' ? (
            <View>
              <Text style={styles.reviewTitle}>{raceLabel(raceType)} plan</Text>
              <View style={styles.reviewGrid}>
                <View style={styles.reviewItem}><Text style={styles.reviewValue}>{projectedWeeks ?? '-'}</Text><Text style={styles.reviewLabel}>Weeks</Text></View>
                <View style={styles.reviewItem}><Text style={styles.reviewValue}>{maxHours}h</Text><Text style={styles.reviewLabel}>Weekly cap</Text></View>
                <View style={styles.reviewItem}><Text style={styles.reviewValue}>{experience}</Text><Text style={styles.reviewLabel}>Level</Text></View>
              </View>
              <Text style={styles.body}>Next, TrainGPT will generate your calendar, assign points to each session, and unlock your first weekly mission.</Text>
            </View>
          ) : null}
        </View>

        {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View> : null}
        {success ? <View style={styles.successBox}><Text style={styles.success}>{success}</Text></View> : null}

        <View style={styles.footerActions}>
          <Pressable onPress={backStep} disabled={stepIndex === 0} style={({ pressed }) => [styles.backButton, stepIndex === 0 && styles.disabledBack, pressed && stepIndex !== 0 && styles.secondaryPressed]}><Text style={styles.backText}>Back</Text></Pressable>
          <Pressable onPress={continueStep} style={({ pressed }) => [styles.continueButton, pressed && styles.primaryPressed]}><Text style={styles.continueText}>{stepIndex === steps.length - 1 ? 'Generate plan' : 'Continue'}</Text></Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.pageX, paddingTop: 58, paddingBottom: 132 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: colors.ink, fontSize: 18, fontWeight: '900', letterSpacing: -0.4 },
  progressText: { color: colors.muted, fontSize: 13, fontWeight: '900' },
  progressTrack: { marginTop: 22, height: 6, borderRadius: 999, backgroundColor: colors.border, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.ink, borderRadius: 999 },
  eyebrow: { marginTop: 46, color: colors.faint, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.9 },
  title: { marginTop: 12, color: colors.ink, fontSize: 42, lineHeight: 43, fontWeight: '900', letterSpacing: -2.2 },
  subtitle: { marginTop: 14, color: colors.inkSoft, fontSize: 16, lineHeight: 25, fontWeight: '500' },
  card: { marginTop: 28, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: 18, ...shadow.card },
  optionStack: { gap: 10 },
  largeOption: { minHeight: 74, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 17, paddingVertical: 14, justifyContent: 'center' },
  largeOptionText: { color: colors.ink, fontSize: 22, fontWeight: '900', letterSpacing: -0.7 },
  largeOptionMeta: { marginTop: 5, color: colors.muted, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  optionActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  optionTextActive: { color: colors.surface },
  pressedOption: { transform: [{ scale: 0.986 }], opacity: 0.9 },
  label: { marginBottom: 10, color: colors.inkSoft, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2 },
  input: { minHeight: 56, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: 16, color: colors.ink, fontSize: 17, fontWeight: '700' },
  textArea: { minHeight: 150, paddingTop: 16, textAlignVertical: 'top', fontWeight: '600' },
  contextBox: { marginTop: 14, borderRadius: radius.lg, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, padding: 15 },
  contextValue: { color: colors.ink, fontSize: 20, fontWeight: '900', letterSpacing: -0.6 },
  contextText: { marginTop: 6, color: colors.muted, fontSize: 13, lineHeight: 20, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '47.8%', minHeight: 88, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  tileText: { color: colors.ink, fontSize: 25, fontWeight: '900', letterSpacing: -0.8 },
  tileMeta: { marginTop: 4, color: colors.muted, fontSize: 12, fontWeight: '800' },
  stravaBox: { backgroundColor: colors.successSoft, borderRadius: radius.lg, borderWidth: 1, borderColor: '#86efac', padding: 18 },
  stravaStatus: { color: colors.success, fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.2 },
  stravaBig: { marginTop: 12, color: colors.ink, fontSize: 26, lineHeight: 29, fontWeight: '900', letterSpacing: -1.1 },
  stravaMeta: { marginTop: 5, color: colors.inkSoft, fontSize: 14, lineHeight: 21, fontWeight: '700' },
  body: { marginTop: 14, color: colors.inkSoft, fontSize: 14, lineHeight: 22, fontWeight: '500' },
  reviewTitle: { color: colors.ink, fontSize: 30, fontWeight: '900', letterSpacing: -1.1 },
  reviewGrid: { marginTop: 18, gap: 9 },
  reviewItem: { borderRadius: radius.lg, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, padding: 15 },
  reviewValue: { color: colors.ink, fontSize: 22, fontWeight: '900' },
  reviewLabel: { marginTop: 5, color: colors.muted, fontSize: 12, fontWeight: '800' },
  errorBox: { marginTop: 14, borderRadius: radius.md, backgroundColor: '#fff1f2', borderWidth: 1, borderColor: '#fecdd3', padding: 13 },
  error: { color: colors.danger, fontWeight: '800', lineHeight: 20 },
  successBox: { marginTop: 14, borderRadius: radius.md, backgroundColor: colors.successSoft, borderWidth: 1, borderColor: '#bbf7d0', padding: 13 },
  success: { color: colors.success, fontWeight: '800', lineHeight: 20 },
  footerActions: { marginTop: 22, flexDirection: 'row', gap: 12 },
  backButton: { width: 96, minHeight: 54, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  disabledBack: { opacity: 0.45 },
  backText: { color: colors.muted, fontSize: 15, fontWeight: '900' },
  continueButton: { flex: 1, minHeight: 54, borderRadius: radius.md, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  primaryPressed: { transform: [{ scale: 0.975 }], opacity: 0.88, backgroundColor: '#27272a' },
  secondaryPressed: { transform: [{ scale: 0.975 }], opacity: 0.88, backgroundColor: colors.surfaceMuted },
  continueText: { color: colors.surface, fontSize: 15, fontWeight: '900' },
});
