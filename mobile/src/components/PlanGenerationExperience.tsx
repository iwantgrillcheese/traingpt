import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow } from '../design/theme';

type Props = {
  currentStep: number;
  steps: string[];
  complete: boolean;
  progressPercent?: number;
};

const weekLabels = ['Base', 'Build', 'Peak', 'Taper'];
const sessionChips = [
  { label: 'Swim', points: '+20', col: 0, row: 1 },
  { label: 'Bike', points: '+40', col: 1, row: 2 },
  { label: 'Run', points: '+30', col: 2, row: 1 },
  { label: 'Brick', points: '+25', col: 3, row: 3 },
  { label: 'Rest', points: '+5', col: 4, row: 0 },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function PlanGenerationExperience({ currentStep, steps, complete, progressPercent }: Props) {
  const reveal = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const estimatedStepProgress = Math.round(((currentStep + 1) / Math.max(steps.length, 1)) * 86);
  const progress = complete ? 100 : clamp(progressPercent ?? estimatedStepProgress, 4, 92);

  useEffect(() => {
    reveal.setValue(0);
    Animated.timing(reveal, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      ])
    );

    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 2100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 2100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );

    pulseLoop.start();
    floatLoop.start();
    return () => {
      pulseLoop.stop();
      floatLoop.stop();
    };
  }, [float, pulse, reveal]);

  const revealY = reveal.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.42] });
  const floatY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });

  const activeMessage = complete
    ? 'Your first weekly mission is ready.'
    : progress >= 88
      ? 'Finalizing your calendar...'
      : steps[currentStep] ?? 'Building your plan...';

  const visibleChips = useMemo(() => sessionChips.slice(0, Math.min(sessionChips.length, currentStep + 1)), [currentStep]);

  return (
    <View style={styles.screen}>
      <Animated.View style={[styles.content, { opacity: reveal, transform: [{ translateY: revealY }] }]}> 
        <Text style={styles.kicker}>{complete ? 'Mission unlocked' : 'Building plan'}</Text>
        <Text style={styles.title}>{complete ? 'Your calendar is ready.' : 'Building your training calendar.'}</Text>
        <Text style={styles.subtitle}>{activeMessage}</Text>

        <View style={styles.stageCard}>
          <Animated.View style={[styles.glow, { opacity: glowOpacity, transform: [{ scale: pulseScale }] }]} />

          <View style={styles.calendarHeader}>
            <View>
              <Text style={styles.cardKicker}>Season structure</Text>
              <Text style={styles.cardTitle}>{complete ? 'First mission ready' : progress >= 88 ? 'Final checks' : 'Assembling weeks'}</Text>
            </View>
            <Text style={styles.percent}>{progress}%</Text>
          </View>

          <View style={styles.weekRow}>
            {weekLabels.map((label, index) => {
              const active = index <= Math.min(3, currentStep);
              return (
                <View key={label} style={[styles.weekBlock, active && styles.weekBlockActive]}>
                  <Text style={[styles.weekLabel, active && styles.weekLabelActive]}>{label}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.calendarGrid}>
            {Array.from({ length: 20 }).map((_, index) => (
              <View key={index} style={styles.gridCell} />
            ))}
            {visibleChips.map((chip, index) => (
              <Animated.View
                key={chip.label}
                style={[
                  styles.sessionChip,
                  {
                    left: 10 + chip.col * 58,
                    top: 12 + chip.row * 40,
                    transform: [{ translateY: index % 2 === 0 ? floatY : 0 }],
                  },
                ]}
              >
                <Text style={styles.sessionLabel}>{chip.label}</Text>
                <Text style={styles.sessionPoints}>{chip.points}</Text>
              </Animated.View>
            ))}
          </View>

          <View style={styles.missionUnlock}>
            <Animated.View style={[styles.medal, { transform: [{ scale: pulseScale }] }]}> 
              <Text style={styles.medalText}>{complete ? '✓' : '★'}</Text>
            </Animated.View>
            <View style={{ flex: 1 }}>
              <Text style={styles.unlockTitle}>{complete ? 'Fitness Score unlocked' : progress >= 88 ? 'Saving your plan' : 'Assigning session points'}</Text>
              <Text style={styles.unlockText}>{progress >= 88 && !complete ? 'Almost there. We only show 100% once your plan is saved.' : 'Key sessions earn more. Every completed workout moves the score.'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>

        <View style={styles.stepList}>
          {steps.map((item, index) => {
            const done = complete || index < currentStep;
            const active = !complete && index === currentStep;
            return (
              <View key={item} style={styles.stepRow}>
                <Text style={[styles.stepMark, (done || active) && styles.stepMarkActive]}>{done ? '✓' : active ? '•' : '·'}</Text>
                <Text style={[styles.stepText, active && styles.stepTextActive, done && styles.stepTextDone]}>{item}</Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.footer}>{complete ? 'Plan saved. Opening your product tour now.' : progress >= 88 ? 'Final generation can take a little longer. Keep the app open.' : 'Keep the app open. Longer plans can take up to a minute.'}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#050806', paddingHorizontal: 22, paddingTop: 76, paddingBottom: 34 },
  content: { flex: 1 },
  kicker: { color: '#9ca3af', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 2.6 },
  title: { marginTop: 14, color: colors.surface, fontSize: 44, lineHeight: 45, fontWeight: '900', letterSpacing: -2.1 },
  subtitle: { marginTop: 14, color: '#d1d5db', fontSize: 18, lineHeight: 27, fontWeight: '700' },
  stageCard: { marginTop: 30, overflow: 'hidden', borderRadius: 30, backgroundColor: '#07351f', padding: 18, minHeight: 390, ...shadow.hero },
  glow: { position: 'absolute', right: -70, top: -80, width: 210, height: 210, borderRadius: 999, backgroundColor: '#86efac' },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardKicker: { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.8 },
  cardTitle: { marginTop: 6, color: colors.surface, fontSize: 23, fontWeight: '900', letterSpacing: -0.8 },
  percent: { color: '#d9f99d', fontSize: 22, fontWeight: '900' },
  weekRow: { marginTop: 18, flexDirection: 'row', gap: 8 },
  weekBlock: { flex: 1, minHeight: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  weekBlockActive: { backgroundColor: 'rgba(217,249,157,0.22)', borderWidth: 1, borderColor: 'rgba(217,249,157,0.35)' },
  weekLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '900' },
  weekLabelActive: { color: '#ecfccb' },
  calendarGrid: { marginTop: 18, height: 180, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.07)', padding: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8, overflow: 'hidden' },
  gridCell: { width: 50, height: 32, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)' },
  sessionChip: { position: 'absolute', width: 74, minHeight: 34, borderRadius: 999, backgroundColor: '#f8fafc', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 9, shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
  sessionLabel: { color: colors.ink, fontSize: 11, fontWeight: '900' },
  sessionPoints: { color: colors.success, fontSize: 10, fontWeight: '900' },
  missionUnlock: { marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.09)', padding: 13 },
  medal: { width: 54, height: 54, borderRadius: 999, backgroundColor: '#86efac', alignItems: 'center', justifyContent: 'center' },
  medalText: { color: colors.ink, fontSize: 25, fontWeight: '900' },
  unlockTitle: { color: colors.surface, fontSize: 17, fontWeight: '900', letterSpacing: -0.4 },
  unlockText: { marginTop: 4, color: 'rgba(255,255,255,0.68)', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  progressTrack: { marginTop: 24, height: 9, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: colors.surface },
  stepList: { marginTop: 24, gap: 14 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  stepMark: { width: 28, height: 28, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.11)', color: '#6b7280', textAlign: 'center', paddingTop: 4, fontSize: 14, fontWeight: '900' },
  stepMarkActive: { backgroundColor: colors.surface, color: colors.ink },
  stepText: { flex: 1, color: '#6b7280', fontSize: 16, lineHeight: 22, fontWeight: '850' },
  stepTextActive: { color: colors.surface },
  stepTextDone: { color: '#d1d5db' },
  footer: { marginTop: 'auto', color: '#a1a1aa', fontSize: 14, lineHeight: 21, fontWeight: '800', textAlign: 'center' },
});
