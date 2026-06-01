import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, Vibration, View } from 'react-native';
import type { CompletedSessionRow, SessionRow } from '../types';
import { apiFetch } from '../lib/api';
import {
  cleanTitle,
  formatDay,
  formatMinutes,
  getCompletionStatus,
  normalizeSport,
} from '../utils/training';
import { getSessionPoints, getSessionPriority } from '../utils/sessionPoints';

type Props = {
  session: SessionRow | null;
  completed: CompletedSessionRow[];
  open: boolean;
  onClose: () => void;
  onMarkDone: (session: SessionRow) => Promise<void> | void;
  onSkip?: (session: SessionRow) => Promise<void> | void;
  onSessionUpdated?: (session: SessionRow) => void;
};

function summarizeDetails(value?: string | null) {
  const text = String(value ?? '')
    .replace(/Purpose:\s*/gi, '')
    .replace(/Workout:\s*/gi, '')
    .replace(/Intensity:\s*/gi, '')
    .replace(/Coach note:\s*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return text || 'Execute this session with control. Keep the goal in mind and avoid turning every workout into a race.';
}

function upgradeUrl() {
  return 'https://traingpt.co/plan-preview?feature=detailed-workouts';
}

function priorityLabel(priority: string) {
  if (priority === 'key') return 'Key session';
  if (priority === 'light') return 'Light session';
  return 'Base session';
}

export function SessionDetailSheet({ session, completed, open, onClose, onMarkDone, onSkip, onSessionUpdated }: Props) {
  const [structuredWorkout, setStructuredWorkout] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plusRequired, setPlusRequired] = useState(false);
  const [banked, setBanked] = useState(false);
  const [markingDone, setMarkingDone] = useState(false);

  const reward = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const cardGlow = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setStructuredWorkout(session?.structured_workout ?? null);
    setError(null);
    setPlusRequired(false);
    setGenerating(false);
    setBanked(false);
    setMarkingDone(false);
    reward.setValue(0);
    buttonScale.setValue(1);
    cardGlow.setValue(0);
    burst.setValue(0);
  }, [buttonScale, burst, cardGlow, reward, session?.id, session?.structured_workout]);

  if (!session) return null;

  const status = getCompletionStatus(session, completed);
  const duration = formatMinutes(session.duration);
  const points = getSessionPoints(session);
  const priority = getSessionPriority(session);
  const isDone = status === 'done' || banked;

  const rewardOpacity = reward.interpolate({ inputRange: [0, 0.12, 0.82, 1], outputRange: [0, 1, 1, 0] });
  const rewardTranslate = reward.interpolate({ inputRange: [0, 1], outputRange: [18, -54] });
  const rewardScale = reward.interpolate({ inputRange: [0, 0.18, 0.52, 1], outputRange: [0.82, 1.18, 1.02, 1] });
  const glowOpacity = cardGlow.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const burstOpacity = burst.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] });
  const burstScale = burst.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1.22] });
  const burstRotate = burst.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '8deg'] });

  const playCompletionAnimation = () => {
    reward.setValue(0);
    cardGlow.setValue(0);
    burst.setValue(0);
    Vibration.vibrate([0, 18, 35, 28]);

    Animated.parallel([
      Animated.sequence([
        Animated.timing(buttonScale, { toValue: 0.94, duration: 80, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(buttonScale, { toValue: 1.04, friction: 4, tension: 150, useNativeDriver: true }),
        Animated.spring(buttonScale, { toValue: 1, friction: 5, tension: 110, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(cardGlow, { toValue: 1, duration: 150, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(cardGlow, { toValue: 0, duration: 1050, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
      Animated.timing(reward, { toValue: 1, duration: 1500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(burst, { toValue: 1, duration: 1150, easing: Easing.out(Easing.back(1.25)), useNativeDriver: true }),
    ]).start();
  };

  const handleMarkDone = async () => {
    if (isDone || markingDone) return;
    setMarkingDone(true);
    setBanked(true);
    playCompletionAnimation();
    try {
      await onMarkDone(session);
    } catch (err) {
      console.error('[SessionDetailSheet] mark done failed', err);
      setBanked(false);
      setError('Could not mark this session done. Try again.');
    } finally {
      setMarkingDone(false);
    }
  };

  const generateDetails = async () => {
    setGenerating(true);
    setError(null);
    setPlusRequired(false);

    try {
      const response = await apiFetch('/api/generate-detailed-session', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: session.id,
          title: session.title,
          sport: session.sport,
          date: session.date,
          details: session.details ?? '',
          fueling: { enabled: false },
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.structured_workout) {
        if (payload?.code === 'PLUS_REQUIRED') {
          setPlusRequired(true);
          setError('Detailed workouts are included with TrainGPT Plus.');
          return;
        }

        setError(payload?.error || 'Could not generate detailed workout.');
        return;
      }

      const nextWorkout = String(payload.structured_workout).trim();
      setStructuredWorkout(nextWorkout);
      onSessionUpdated?.({ ...session, structured_workout: nextWorkout });
    } catch (err) {
      console.error('[SessionDetailSheet] generate details failed', err);
      setError('Could not reach TrainGPT. Try again in a moment.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.headerRow}>
              <View style={styles.badges}>
                <Text style={styles.badge}>{normalizeSport(session.sport)}</Text>
                <Text style={styles.badge}>{formatDay(session.date)}</Text>
                {duration ? <Text style={styles.badge}>{duration}</Text> : null}
              </View>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>

            <Text style={styles.title}>{cleanTitle(session.title)}</Text>

            <Animated.View style={[styles.rewardToast, { opacity: rewardOpacity, transform: [{ translateY: rewardTranslate }, { scale: rewardScale }] }]}> 
              <Text style={styles.rewardText}>+{points} pts banked</Text>
              <Text style={styles.rewardSubtext}>Fitness Score updated</Text>
            </Animated.View>

            <Animated.View style={[styles.burstWrap, { opacity: burstOpacity, transform: [{ scale: burstScale }, { rotate: burstRotate }] }]}> 
              <Text style={styles.burstText}>+{points}</Text>
              <Text style={styles.burstSubtext}>POINTS</Text>
            </Animated.View>

            <Animated.View style={[styles.pointsGlow, { opacity: glowOpacity }]} />
            <View style={[styles.pointsCard, isDone && styles.pointsCardDone]}>
              <View>
                <Text style={styles.sectionLabel}>Training value</Text>
                <Text style={styles.pointsTitle}>{isDone ? 'Banked' : `${points} points`}</Text>
              </View>
              <Text style={[styles.priorityBadge, priority === 'key' && styles.keyBadge]}>{isDone ? 'Completed' : priorityLabel(priority)}</Text>
            </View>

            <View style={styles.overviewCard}>
              <Text style={styles.sectionLabel}>Why this matters</Text>
              <Text style={styles.body}>{summarizeDetails(session.details)}</Text>
            </View>

            <View style={styles.detailCard}>
              <View style={styles.detailHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionLabel}>Detailed workout</Text>
                  <Text style={styles.muted}>{structuredWorkout ? 'Ready for execution.' : 'Generate warm-up, main set, cooldown, and execution notes.'}</Text>
                </View>
                <Text style={styles.plusBadge}>Plus</Text>
              </View>

              {structuredWorkout ? <Text style={styles.body}>{structuredWorkout}</Text> : null}
              {error ? <Text style={plusRequired ? styles.plusError : styles.error}>{error}</Text> : null}

              {plusRequired ? (
                <Pressable onPress={() => Linking.openURL(upgradeUrl())} style={styles.generateButton}>
                  <Text style={styles.generateText}>Unlock Plus</Text>
                </Pressable>
              ) : (
                <Pressable onPress={generateDetails} disabled={generating} style={[styles.generateButton, generating && styles.disabledButton]}>
                  {generating ? <ActivityIndicator color="#fff" /> : <Text style={styles.generateText}>{structuredWorkout ? 'Regenerate details' : 'Generate details'}</Text>}
                </Pressable>
              )}
            </View>

            <View style={styles.actions}>
              <Animated.View style={[styles.animatedAction, { transform: [{ scale: buttonScale }] }]}> 
                <Pressable onPress={handleMarkDone} disabled={isDone || markingDone} style={[styles.primaryButton, isDone && styles.doneButton]}>
                  <Text style={styles.primaryText}>{isDone ? '✓ Done' : markingDone ? 'Banking...' : `Mark done · +${points} pts`}</Text>
                </Pressable>
              </Animated.View>
              <Pressable onPress={() => onSkip?.(session)} disabled={isDone} style={[styles.secondaryButton, isDone && styles.disabledButton]}>
                <Text style={styles.secondaryText}>{status === 'skipped' ? 'Skipped' : 'Skip'}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(9,9,11,0.35)' },
  sheet: {
    maxHeight: '90%',
    backgroundColor: '#fbfbfa',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  scrollContent: { paddingBottom: 24 },
  handle: { alignSelf: 'center', width: 46, height: 5, borderRadius: 999, backgroundColor: '#d4d4d8', marginBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, flex: 1 },
  badge: { overflow: 'hidden', borderRadius: 999, borderWidth: 1, borderColor: '#e4e4e7', backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 6, color: '#52525b', fontSize: 12, fontWeight: '700' },
  closeButton: { width: 42, height: 42, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4e4e7', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#71717a', fontSize: 26, lineHeight: 28, fontWeight: '500' },
  title: { marginTop: 18, color: '#09090b', fontSize: 32, lineHeight: 34, fontWeight: '900', letterSpacing: -1.4 },
  rewardToast: { position: 'absolute', top: 92, right: 18, zIndex: 12, borderRadius: 999, backgroundColor: '#dcfce7', borderWidth: 1, borderColor: '#86efac', paddingHorizontal: 14, paddingVertical: 9 },
  rewardText: { color: '#166534', fontSize: 14, fontWeight: '900' },
  rewardSubtext: { marginTop: 1, color: '#15803d', fontSize: 11, fontWeight: '800' },
  burstWrap: { position: 'absolute', top: 88, alignSelf: 'center', zIndex: 11, width: 112, height: 112, borderRadius: 999, backgroundColor: '#86efac', borderWidth: 8, borderColor: '#dcfce7', alignItems: 'center', justifyContent: 'center', shadowColor: '#166534', shadowOpacity: 0.3, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  burstText: { color: '#052e16', fontSize: 34, lineHeight: 36, fontWeight: '900', letterSpacing: -1.4 },
  burstSubtext: { color: '#166534', fontSize: 10, fontWeight: '900', letterSpacing: 1.6 },
  pointsGlow: { position: 'absolute', top: 108, left: 0, right: 0, height: 92, borderRadius: 28, backgroundColor: '#bbf7d0' },
  pointsCard: { marginTop: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#09090b', borderRadius: 24, padding: 16 },
  pointsCardDone: { backgroundColor: '#14532d' },
  pointsTitle: { marginTop: 6, color: '#fff', fontSize: 28, lineHeight: 30, fontWeight: '900', letterSpacing: -1.1 },
  priorityBadge: { overflow: 'hidden', borderRadius: 999, backgroundColor: '#fff', color: '#3f3f46', paddingHorizontal: 11, paddingVertical: 7, fontSize: 12, fontWeight: '900' },
  keyBadge: { backgroundColor: '#dcfce7', color: '#166534' },
  overviewCard: { marginTop: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 24, padding: 16 },
  detailCard: { marginTop: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 24, padding: 16 },
  detailHeader: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  sectionLabel: { color: '#a1a1aa', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.4 },
  body: { marginTop: 8, color: '#3f3f46', fontSize: 14, lineHeight: 22 },
  muted: { marginTop: 6, color: '#71717a', fontSize: 13, lineHeight: 20 },
  error: { marginTop: 10, color: '#be123c', fontSize: 13, fontWeight: '700' },
  plusError: { marginTop: 10, color: '#854d0e', fontSize: 13, fontWeight: '700' },
  plusBadge: { overflow: 'hidden', borderRadius: 999, backgroundColor: '#09090b', color: '#fff', paddingHorizontal: 10, paddingVertical: 5, fontSize: 11, fontWeight: '900' },
  generateButton: { marginTop: 12, minHeight: 48, borderRadius: 16, backgroundColor: '#09090b', alignItems: 'center', justifyContent: 'center' },
  generateText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  disabledButton: { opacity: 0.6 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  animatedAction: { flex: 1 },
  primaryButton: { minHeight: 54, borderRadius: 18, backgroundColor: '#09090b', alignItems: 'center', justifyContent: 'center' },
  doneButton: { backgroundColor: '#166534' },
  primaryText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  secondaryButton: { flex: 1, minHeight: 54, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4e4e7', alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#3f3f46', fontWeight: '900', fontSize: 15 },
});
