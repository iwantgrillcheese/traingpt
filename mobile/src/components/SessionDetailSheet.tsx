import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { CompletedSessionRow, SessionRow } from '../types';
import {
  cleanTitle,
  formatDay,
  formatMinutes,
  getCompletionStatus,
  normalizeSport,
} from '../utils/training';

type Props = {
  session: SessionRow | null;
  completed: CompletedSessionRow[];
  open: boolean;
  onClose: () => void;
  onMarkDone: (session: SessionRow) => Promise<void> | void;
  onSkip?: (session: SessionRow) => Promise<void> | void;
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

export function SessionDetailSheet({ session, completed, open, onClose, onMarkDone, onSkip }: Props) {
  if (!session) return null;

  const status = getCompletionStatus(session, completed);
  const duration = formatMinutes(session.duration);

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
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

          <View style={styles.overviewCard}>
            <Text style={styles.sectionLabel}>Why this matters</Text>
            <Text style={styles.body}>{summarizeDetails(session.details)}</Text>
          </View>

          {session.structured_workout ? (
            <View style={styles.detailCard}>
              <Text style={styles.sectionLabel}>Detailed workout</Text>
              <Text style={styles.body}>{session.structured_workout}</Text>
            </View>
          ) : (
            <View style={styles.detailCard}>
              <Text style={styles.sectionLabel}>Detailed workout</Text>
              <Text style={styles.muted}>Native generation comes next. For now, generate details on web and they will appear here.</Text>
            </View>
          )}

          <View style={styles.actions}>
            <Pressable onPress={() => onMarkDone(session)} style={[styles.primaryButton, status === 'done' && styles.doneButton]}>
              <Text style={styles.primaryText}>{status === 'done' ? 'Done' : 'Mark done'}</Text>
            </Pressable>
            <Pressable onPress={() => onSkip?.(session)} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>{status === 'skipped' ? 'Skipped' : 'Skip'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(9,9,11,0.35)' },
  sheet: {
    maxHeight: '88%',
    backgroundColor: '#fbfbfa',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 34,
  },
  handle: { alignSelf: 'center', width: 46, height: 5, borderRadius: 999, backgroundColor: '#d4d4d8', marginBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, flex: 1 },
  badge: { overflow: 'hidden', borderRadius: 999, borderWidth: 1, borderColor: '#e4e4e7', backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 6, color: '#52525b', fontSize: 12, fontWeight: '700' },
  closeButton: { width: 42, height: 42, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4e4e7', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#71717a', fontSize: 26, lineHeight: 28, fontWeight: '500' },
  title: { marginTop: 18, color: '#09090b', fontSize: 32, lineHeight: 34, fontWeight: '900', letterSpacing: -1.4 },
  overviewCard: { marginTop: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 24, padding: 16 },
  detailCard: { marginTop: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 24, padding: 16 },
  sectionLabel: { color: '#a1a1aa', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.4 },
  body: { marginTop: 8, color: '#3f3f46', fontSize: 14, lineHeight: 22 },
  muted: { marginTop: 8, color: '#71717a', fontSize: 14, lineHeight: 22 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  primaryButton: { flex: 1, minHeight: 54, borderRadius: 18, backgroundColor: '#09090b', alignItems: 'center', justifyContent: 'center' },
  doneButton: { backgroundColor: '#18181b' },
  primaryText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  secondaryButton: { flex: 1, minHeight: 54, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4e4e7', alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#3f3f46', fontWeight: '900', fontSize: 15 },
});
