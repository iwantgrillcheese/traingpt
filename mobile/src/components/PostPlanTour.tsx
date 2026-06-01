import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow } from '../design/theme';

type Props = {
  visible: boolean;
  onOpenToday: () => void;
  onOpenSchedule: () => void;
};

const steps = [
  {
    kicker: 'Your plan is ready',
    title: 'Your schedule is now your training room.',
    text: 'We turned your race goal into daily sessions. Open Schedule whenever you want to see the full build.',
    stat: 'Calendar built',
  },
  {
    kicker: 'Points matter',
    title: 'Every session has a training value.',
    text: 'Key workouts are worth more. Technique and recovery still count, but they do not outweigh the sessions that move race readiness most.',
    stat: '+40 key sessions',
  },
  {
    kicker: 'Bank the work',
    title: 'Complete sessions to earn points.',
    text: 'Mark sessions done manually or let Strava-matched workouts count automatically. Either way, completed training feeds your weekly progress.',
    stat: 'Manual + Strava',
  },
  {
    kicker: 'Fitness Score',
    title: 'Your score rises through consistency.',
    text: 'Bank weekly points, protect the key sessions, and build momentum. This is the number you are chasing.',
    stat: 'Score unlocked',
  },
];

export function PostPlanTour({ visible, onOpenToday, onOpenSchedule }: Props) {
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const isLast = index === steps.length - 1;

  const next = () => {
    if (!isLast) setIndex((current) => current + 1);
  };

  const openToday = () => {
    setIndex(0);
    onOpenToday();
  };

  const openSchedule = () => {
    setIndex(0);
    onOpenSchedule();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.brand}>TrainGPT</Text>
            <Text style={styles.counter}>{index + 1} / {steps.length}</Text>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${((index + 1) / steps.length) * 100}%` }]} />
          </View>

          <View style={styles.heroCard}>
            <View style={styles.orbitOuter}>
              <View style={styles.orbitMid}>
                <View style={styles.orbitInner}>
                  <Text style={styles.orbitText}>★</Text>
                </View>
              </View>
            </View>
            <Text style={styles.statPill}>{step.stat}</Text>
          </View>

          <Text style={styles.kicker}>{step.kicker}</Text>
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.text}>{step.text}</Text>

          <View style={styles.dots}>
            {steps.map((_, dotIndex) => (
              <View key={dotIndex} style={[styles.dot, dotIndex === index && styles.dotActive]} />
            ))}
          </View>

          {isLast ? (
            <View style={styles.finalActions}>
              <Pressable onPress={openSchedule} style={styles.secondaryButton}>
                <Text style={styles.secondaryText}>View Schedule</Text>
              </Pressable>
              <Pressable onPress={openToday} style={styles.primaryButton}>
                <Text style={styles.primaryText}>Open Today</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={next} style={styles.primaryButtonFull}>
              <Text style={styles.primaryText}>Continue</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(9,9,11,0.24)' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 28,
    minHeight: '82%',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: colors.ink, fontSize: 20, fontWeight: '900', letterSpacing: -0.7 },
  counter: { color: colors.muted, fontSize: 14, fontWeight: '900' },
  progressTrack: { marginTop: 18, height: 8, borderRadius: 999, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: colors.ink },
  heroCard: {
    marginTop: 28,
    minHeight: 210,
    borderRadius: radius.xxl,
    backgroundColor: '#07522f',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadow.hero,
  },
  orbitOuter: { width: 150, height: 150, borderRadius: 999, backgroundColor: 'rgba(134,239,172,0.18)', alignItems: 'center', justifyContent: 'center' },
  orbitMid: { width: 112, height: 112, borderRadius: 999, backgroundColor: '#86efac', alignItems: 'center', justifyContent: 'center' },
  orbitInner: { width: 70, height: 70, borderRadius: 999, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  orbitText: { color: colors.surface, fontSize: 32, fontWeight: '900' },
  statPill: { position: 'absolute', bottom: 18, overflow: 'hidden', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)', color: colors.surface, paddingHorizontal: 13, paddingVertical: 8, fontSize: 13, fontWeight: '900' },
  kicker: { marginTop: 28, color: colors.faint, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.8 },
  title: { marginTop: 12, color: colors.ink, fontSize: 39, lineHeight: 40, fontWeight: '900', letterSpacing: -2 },
  text: { marginTop: 14, color: colors.inkSoft, fontSize: 17, lineHeight: 26, fontWeight: '500' },
  dots: { marginTop: 22, flexDirection: 'row', gap: 8 },
  dot: { width: 7, height: 7, borderRadius: 999, backgroundColor: colors.borderStrong },
  dotActive: { width: 24, backgroundColor: colors.ink },
  primaryButtonFull: { marginTop: 28, minHeight: 58, borderRadius: 20, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  finalActions: { marginTop: 28, flexDirection: 'row', gap: 12 },
  primaryButton: { flex: 1.3, minHeight: 58, borderRadius: 20, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  secondaryButton: { flex: 1, minHeight: 58, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: colors.surface, fontSize: 16, fontWeight: '900' },
  secondaryText: { color: colors.ink, fontSize: 16, fontWeight: '900' },
});
