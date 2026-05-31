import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, shadow, spacing } from '../design/theme';
import { useAuth } from '../auth/AuthProvider';
import { apiFetch } from '../lib/api';

type RaceType = 'Sprint' | 'Olympic' | 'Half Ironman (70.3)' | 'Ironman (140.6)';
type Experience = 'Beginner' | 'Intermediate' | 'Advanced';
type StepKey = 'race' | 'date' | 'experience' | 'hours' | 'strava' | 'notes' | 'review';

const raceTypes: RaceType[] = ['Sprint', 'Olympic', 'Half Ironman (70.3)', 'Ironman (140.6)'];
const experiences: Experience[] = ['Beginner', 'Intermediate', 'Advanced'];
const hourOptions = ['3-5', '6-8', '9-12', '12+'];
const steps: { key: StepKey; eyebrow: string; title: string; subtitle: string }[] = [
  { key: 'race', eyebrow: 'Step 1', title: 'What are you training for?', subtitle: 'Start with the race distance. TrainGPT will shape the calendar around the demands of the event.' },
  { key: 'date', eyebrow: 'Step 2', title: 'When is race day?', subtitle: 'Your race date controls the length of the build, taper timing, and first-week ramp.' },
  { key: 'experience', eyebrow: 'Step 3', title: 'Where are you starting from?', subtitle: 'Choose the level that best reflects your current training background.' },
  { key: 'hours', eyebrow: 'Step 4', title: 'How many hours can you train?', subtitle: 'Pick a realistic weekly range. A good plan fits your life before it stretches your fitness.' },
  { key: 'strava', eyebrow: 'Step 5', title: 'Use your training history.', subtitle: 'When Strava is connected, TrainGPT uses recent volume and sport balance to calibrate the plan.' },
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

function generationSteps(hasStrava: boolean) {
  return hasStrava
    ? [
        'Analyzing your recent Strava activity…',
        'Finding your swim, bike, and run balance…',
        'Estimating your current training load…',
        'Building your race-specific progression…',
        'Structuring your first training week…',
        'Finalizing your calendar…',
      ]
    : [
        'Reading your race goal…',
        'Balancing swim, bike, and run…',
        'Choosing a safe starting load…',
        'Building your race-specific progression…',
        'Structuring your first training week…',
        'Finalizing your calendar…',
      ];
}

export function PlanScreen() {
  const { user } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);
  const [raceType, setRaceType] = useState<RaceType>('Half Ironman (70.3)');
  const [raceDate, setRaceDate] = useState(defaultRaceDate());
  const [experience, setExperience] = useState<Experience>('Intermediate');
  const [hourBand, setHourBand] = useState('6-8');
  const [maxHours, setMaxHours] = useState('8');
  const [notes, setNotes] = useState('');
  const [hasStrava] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const current = steps[stepIndex];
  const step = current.key;
  const magicSteps = generationSteps(hasStrava);

  const projectedWeeks = useMemo(() => {
    const parsed = new Date(`${raceDate}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return null;
    const days = Math.ceil((parsed.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days <= 0) return null;
    return Math.max(1, Math.round(days / 7));
  }, [raceDate]);

  useEffect(() => {
    if (!generating) return;
    const interval = setInterval(() => {
      setGenerationStep((value) => Math.min(value + 1, magicSteps.length - 1));
    }, 2800);
    return () => clearInterval(interval);
  }, [generating, magicSteps.length]);

  const generatePlan = async () => {
    if (!user?.id) return;
    const hours = Number(maxHours);
    if (!raceDate || !Number.isFinite(hours) || hours <= 0) {
      setError('Enter a valid race date and weekly training hours.');
      return;
    }

    setGenerating(true);
    setGenerationStep(0);
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

      setGenerationStep(magicSteps.length - 1);
      setSuccess('Your plan is ready. Open Today or Schedule and pull to refresh.');
      setTimeout(() => setGenerating(false), 900);
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
    return (
      <View style={styles.magicScreen}>
        <View style={styles.magicOrbOuter}><View style={styles.magicOrbInner}><Text style={styles.magicSpark}>✦</Text></View></View>
        <Text style={styles.magicEyebrow}>Generating plan</Text>
        <Text style={styles.magicTitle}>Building your training calendar.</Text>
        <Text style={styles.magicSubtitle}>{magicSteps[generationStep]}</Text>
        <View style={styles.magicProgressTrack}>
          <View style={[styles.magicProgressFill, { width: `${((generationStep + 1) / magicSteps.length) * 100}%` }]} />
        </View>
        <View style={styles.magicList}>
          {magicSteps.map((item, index) => (
            <View key={item} style={styles.magicRow}>
              <Text style={[styles.magicCheck, index <= generationStep && styles.magicCheckActive]}>{index <= generationStep ? '✓' : '·'}</Text>
              <Text style={[styles.magicItem, index === generationStep && styles.magicItemActive]}>{item}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.magicFooter}>Keep the app open. Longer plans can take up to a minute.</Text>
      </View>
    );
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
                <Pressable key={option} onPress={() => setRaceType(option)} style={[styles.largeOption, raceType === option && styles.optionActive]}>
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
              <View style={styles.contextBox}><Text style={styles.contextValue}>{projectedWeeks ?? '—'} weeks to build</Text><Text style={styles.contextText}>TrainGPT will build progression, recovery, peak, and taper from this timeline.</Text></View>
            </View>
          ) : null}

          {step === 'experience' ? (
            <View style={styles.optionStack}>
              {experiences.map((option) => (
                <Pressable key={option} onPress={() => setExperience(option)} style={[styles.largeOption, experience === option && styles.optionActive]}>
                  <Text style={[styles.largeOptionText, experience === option && styles.optionTextActive]}>{option}</Text>
                  <Text style={[styles.largeOptionMeta, experience === option && styles.optionTextActive]}>{option === 'Beginner' ? 'Newer to structured triathlon training' : option === 'Intermediate' ? 'Consistent training, building toward performance' : 'Experienced athlete with higher training tolerance'}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {step === 'hours' ? (
            <View style={styles.grid}>
              {hourOptions.map((option) => (
                <Pressable key={option} onPress={() => { setHourBand(option); setMaxHours(parseHours(option)); }} style={[styles.tile, hourBand === option && styles.optionActive]}>
                  <Text style={[styles.tileText, hourBand === option && styles.optionTextActive]}>{option}</Text>
                  <Text style={[styles.tileMeta, hourBand === option && styles.optionTextActive]}>hrs/wk</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {step === 'strava' ? (
            <View>
              <View style={styles.stravaBox}>
                <Text style={styles.stravaStatus}>Strava connected</Text>
                <Text style={styles.stravaBig}>49 recent activities</Text>
                <Text style={styles.stravaMeta}>39.8h total · Run/Bike/Swim 14/8/0</Text>
              </View>
              <Text style={styles.body}>We’ll use this to estimate recent load, discipline balance, and whether your plan should start conservatively or aggressively.</Text>
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
                <View style={styles.reviewItem}><Text style={styles.reviewValue}>{projectedWeeks ?? '—'}</Text><Text style={styles.reviewLabel}>Weeks</Text></View>
                <View style={styles.reviewItem}><Text style={styles.reviewValue}>{maxHours}h</Text><Text style={styles.reviewLabel}>Weekly cap</Text></View>
                <View style={styles.reviewItem}><Text style={styles.reviewValue}>{experience}</Text><Text style={styles.reviewLabel}>Level</Text></View>
              </View>
              <Text style={styles.body}>Next, TrainGPT will generate your calendar and turn this into your first week of training.</Text>
            </View>
          ) : null}
        </View>

        {error ? <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View> : null}
        {success ? <View style={styles.successBox}><Text style={styles.success}>{success}</Text></View> : null}

        <View style={styles.footerActions}>
          <Pressable onPress={backStep} disabled={stepIndex === 0} style={[styles.backButton, stepIndex === 0 && styles.disabledBack]}><Text style={styles.backText}>Back</Text></Pressable>
          <Pressable onPress={continueStep} style={styles.continueButton}><Text style={styles.continueText}>{stepIndex === steps.length - 1 ? 'Generate plan' : 'Continue'}</Text></Pressable>
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
  stravaBig: { marginTop: 12, color: colors.ink, fontSize: 28, fontWeight: '900', letterSpacing: -1.1 },
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
  disabledBack: { opacity: 0.4 },
  backText: { color: colors.muted, fontWeight: '900' },
  continueButton: { flex: 1, minHeight: 54, borderRadius: radius.md, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  continueText: { color: colors.surface, fontSize: 15, fontWeight: '900' },
  magicScreen: { flex: 1, backgroundColor: colors.ink, paddingHorizontal: spacing.pageX, paddingTop: 92, paddingBottom: 42 },
  magicOrbOuter: { alignSelf: 'center', width: 132, height: 132, borderRadius: 999, backgroundColor: '#1f2937', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#374151' },
  magicOrbInner: { width: 84, height: 84, borderRadius: 999, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  magicSpark: { color: colors.ink, fontSize: 36, fontWeight: '900' },
  magicEyebrow: { marginTop: 44, color: '#a1a1aa', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.8 },
  magicTitle: { marginTop: 12, color: '#ffffff', fontSize: 40, lineHeight: 42, fontWeight: '900', letterSpacing: -2 },
  magicSubtitle: { marginTop: 14, color: '#d4d4d8', fontSize: 17, lineHeight: 25, fontWeight: '600' },
  magicProgressTrack: { marginTop: 30, height: 8, borderRadius: 999, backgroundColor: '#27272a', overflow: 'hidden' },
  magicProgressFill: { height: '100%', borderRadius: 999, backgroundColor: '#ffffff' },
  magicList: { marginTop: 30, gap: 15 },
  magicRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  magicCheck: { width: 24, height: 24, borderRadius: 999, overflow: 'hidden', backgroundColor: '#27272a', color: '#a1a1aa', textAlign: 'center', paddingTop: 2, fontWeight: '900' },
  magicCheckActive: { backgroundColor: '#ffffff', color: colors.ink },
  magicItem: { flex: 1, color: '#71717a', fontSize: 15, lineHeight: 21, fontWeight: '700' },
  magicItemActive: { color: '#ffffff' },
  magicFooter: { marginTop: 'auto', color: '#a1a1aa', fontSize: 13, lineHeight: 20, textAlign: 'center', fontWeight: '600' },
});
