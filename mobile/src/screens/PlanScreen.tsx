import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, shadow, spacing } from '../design/theme';
import { useAuth } from '../auth/AuthProvider';
import { apiFetch } from '../lib/api';

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
  { key: 'strava', eyebrow: 'Step 5', title: 'Use your training history.', subtitle: 'When Strava is connected, TrainGPT uses recent volume and sport balance to calibrate the plan.' },
  { key: 'notes', eyebrow: 'Step 6', title: 'Any constraints?', subtitle: 'Tell your coach about injuries, travel, weak disciplines, preferred long ride days, or schedule limits.' },
  { key: 'review', eyebrow: 'Step 7', title: 'Ready to build.', subtitle: 'Review the setup. Then TrainGPT will generate the calendar and session structure.' },
];

const floatingCards = [
  { label: 'Swim', meta: 'Technique', x: -128, y: -18, delay: 0 },
  { label: 'Bike', meta: 'Endurance', x: 102, y: 8, delay: 280 },
  { label: 'Run', meta: 'Threshold', x: -98, y: 98, delay: 560 },
  { label: 'Brick', meta: 'Race prep', x: 112, y: 132, delay: 840 },
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

export function PlanScreen({ onPlanCreated }: PlanScreenProps) {
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
  const [generationComplete, setGenerationComplete] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pulse = useRef(new Animated.Value(0)).current;
  const orbit = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const reveal = useRef(new Animated.Value(0)).current;

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

    pulse.setValue(0);
    orbit.setValue(0);
    drift.setValue(0);
    reveal.setValue(0);

    Animated.timing(reveal, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      ])
    );
    const orbitLoop = Animated.loop(
      Animated.timing(orbit, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: true })
    );
    const driftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );

    pulseLoop.start();
    orbitLoop.start();
    driftLoop.start();

    return () => {
      pulseLoop.stop();
      orbitLoop.stop();
      driftLoop.stop();
    };
  }, [drift, generating, orbit, pulse, reveal]);

  useEffect(() => {
    if (!generating || generationComplete) return;
    const interval = setInterval(() => {
      setGenerationStep((value) => Math.min(value + 1, magicSteps.length - 1));
    }, 2400);
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
      setGenerationComplete(true);
      setSuccess('Your calendar is ready. Opening Schedule…');
      setTimeout(() => {
        setGenerating(false);
        onPlanCreated?.();
      }, 1400);
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

  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.32] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.48] });
  const orbitRotate = orbit.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const reverseOrbitRotate = orbit.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });
  const floatY = drift.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });
  const revealTranslate = reveal.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });

  if (generating) {
    return (
      <View style={styles.magicScreen}>
        <Animated.View style={[styles.magicBackdropOne, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />
        <Animated.View style={[styles.magicBackdropTwo, { opacity: glowOpacity, transform: [{ scale: pulseScale }] }]} />

        <Animated.View style={[styles.magicHero, { opacity: reveal, transform: [{ translateY: revealTranslate }] }]}>
          <View style={styles.orbStage}>
            <Animated.View style={[styles.orbitRing, { transform: [{ rotate: orbitRotate }] }]}>
              <View style={styles.orbitDotTop} />
              <View style={styles.orbitDotBottom} />
            </Animated.View>
            <Animated.View style={[styles.orbitRingSmall, { transform: [{ rotate: reverseOrbitRotate }] }]}>
              <View style={styles.orbitDotSide} />
            </Animated.View>
            {floatingCards.map((card, index) => (
              <Animated.View
                key={card.label}
                style={[
                  styles.floatCard,
                  {
                    left: 138 + card.x,
                    top: 120 + card.y,
                    opacity: reveal,
                    transform: [{ translateY: index % 2 === 0 ? floatY : Animated.multiply(floatY, -1) }],
                  },
                ]}
              >
                <Text style={styles.floatCardLabel}>{card.label}</Text>
                <Text style={styles.floatCardMeta}>{card.meta}</Text>
              </Animated.View>
            ))}
            <Animated.View style={[styles.magicOrbOuter, { transform: [{ scale: pulseScale }] }]}>
              <View style={styles.magicOrbInner}>
                <Text style={styles.magicSpark}>{generationComplete ? '✓' : '✦'}</Text>
              </View>
            </Animated.View>
          </View>
        </Animated.View>

        <Animated.View style={[styles.magicCopy, { opacity: reveal, transform: [{ translateY: revealTranslate }] }]}>
          <Text style={styles.magicEyebrow}>{generationComplete ? 'Calendar ready' : 'Generating plan'}</Text>
          <Text style={styles.magicTitle}>{generationComplete ? 'Your season is built.' : 'Building your training calendar.'}</Text>
          <Text style={styles.magicSubtitle}>{generationComplete ? 'Opening your schedule…' : magicSteps[generationStep]}</Text>
          <View style={styles.magicProgressTrack}>
            <View style={[styles.magicProgressFill, { width: `${((generationStep + 1) / magicSteps.length) * 100}%` }]} />
          </View>
        </Animated.View>

        <View style={styles.magicList}>
          {magicSteps.map((item, index) => {
            const complete = index < generationStep || generationComplete;
            const active = index === generationStep && !generationComplete;
            return (
              <View key={item} style={styles.magicRow}>
                <Text style={[styles.magicCheck, (complete || active) && styles.magicCheckActive]}>{complete ? '✓' : active ? '•' : '·'}</Text>
                <Text style={[styles.magicItem, active && styles.magicItemActive, complete && styles.magicItemDone]}>{item}</Text>
              </View>
            );
          })}
        </View>
        <Text style={styles.magicFooter}>{generationComplete ? 'Plan saved. Schedule is refreshing now.' : 'Keep the app open. Longer plans can take up to a minute.'}</Text>
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
  magicScreen: { flex: 1, backgroundColor: '#050507', paddingHorizontal: spacing.pageX, paddingTop: 54, paddingBottom: 42, overflow: 'hidden' },
  magicBackdropOne: { position: 'absolute', top: -120, left: -80, width: 280, height: 280, borderRadius: 999, backgroundColor: '#1f3b73' },
  magicBackdropTwo: { position: 'absolute', bottom: 120, right: -110, width: 320, height: 320, borderRadius: 999, backgroundColor: '#164e63' },
  magicHero: { height: 300, alignItems: 'center', justifyContent: 'center' },
  orbStage: { width: 320, height: 300, alignItems: 'center', justifyContent: 'center' },
  orbitRing: { position: 'absolute', width: 214, height: 214, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  orbitRingSmall: { position: 'absolute', width: 156, height: 156, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  orbitDotTop: { position: 'absolute', top: -5, left: 100, width: 10, height: 10, borderRadius: 999, backgroundColor: '#ffffff' },
  orbitDotBottom: { position: 'absolute', bottom: 16, right: 18, width: 7, height: 7, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.72)' },
  orbitDotSide: { position: 'absolute', top: 70, right: -4, width: 8, height: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.82)' },
  magicOrbOuter: { width: 140, height: 140, borderRadius: 999, backgroundColor: 'rgba(31,41,55,0.96)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', shadowColor: '#ffffff', shadowOpacity: 0.18, shadowRadius: 28, shadowOffset: { width: 0, height: 0 } },
  magicOrbInner: { width: 86, height: 86, borderRadius: 999, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  magicSpark: { color: colors.ink, fontSize: 36, fontWeight: '900' },
  floatCard: { position: 'absolute', minWidth: 88, borderRadius: 20, paddingHorizontal: 13, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  floatCardLabel: { color: '#ffffff', fontSize: 14, fontWeight: '900', letterSpacing: -0.2 },
  floatCardMeta: { marginTop: 2, color: '#a1a1aa', fontSize: 11, fontWeight: '800' },
  magicCopy: { marginTop: 4 },
  magicEyebrow: { color: '#a1a1aa', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.9 },
  magicTitle: { marginTop: 12, color: '#ffffff', fontSize: 42, lineHeight: 43, fontWeight: '900', letterSpacing: -2.2 },
  magicSubtitle: { marginTop: 14, color: '#d4d4d8', fontSize: 17, lineHeight: 25, fontWeight: '700' },
  magicProgressTrack: { marginTop: 30, height: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden' },
  magicProgressFill: { height: '100%', borderRadius: 999, backgroundColor: '#ffffff' },
  magicList: { marginTop: 30, gap: 15 },
  magicRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  magicCheck: { width: 27, height: 27, borderRadius: 999, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.10)', color: '#a1a1aa', textAlign: 'center', paddingTop: 3, fontWeight: '900' },
  magicCheckActive: { backgroundColor: '#ffffff', color: colors.ink },
  magicItem: { flex: 1, color: '#71717a', fontSize: 15, lineHeight: 21, fontWeight: '800' },
  magicItemActive: { color: '#ffffff' },
  magicItemDone: { color: '#d4d4d8' },
  magicFooter: { marginTop: 'auto', color: '#a1a1aa', fontSize: 13, lineHeight: 20, textAlign: 'center', fontWeight: '700' },
});
