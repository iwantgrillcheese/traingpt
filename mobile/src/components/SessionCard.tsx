import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CompletedSessionRow, SessionRow } from '../types';
import { cleanTitle, formatDay, formatMinutes, getCompletionStatus, normalizeSport } from '../utils/training';

type Props = {
  session: SessionRow;
  completed?: CompletedSessionRow[];
  onPress?: () => void;
};

export function SessionCard({ session, completed = [], onPress }: Props) {
  const status = getCompletionStatus(session, completed);
  const duration = formatMinutes(session.duration);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.headerRow}>
        <Text style={styles.meta}>{formatDay(session.date)} · {normalizeSport(session.sport)}{duration ? ` · ${duration}` : ''}</Text>
        {status ? <Text style={[styles.status, status === 'done' ? styles.done : styles.skipped]}>{status === 'done' ? 'Done' : 'Skipped'}</Text> : null}
      </View>
      <Text style={styles.title}>{cleanTitle(session.title)}</Text>
      {session.details ? <Text numberOfLines={2} style={styles.details}>{session.details.replace(/Purpose:|Workout:|Intensity:/gi, '').trim()}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderColor: '#e4e4e7',
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#18181b',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  pressed: { transform: [{ scale: 0.995 }], opacity: 0.9 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  meta: { color: '#71717a', fontSize: 12, fontWeight: '600', flex: 1 },
  status: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, fontSize: 11, fontWeight: '700' },
  done: { backgroundColor: '#18181b', color: '#ffffff' },
  skipped: { backgroundColor: '#f4f4f5', color: '#71717a' },
  title: { color: '#09090b', fontSize: 18, fontWeight: '700', letterSpacing: -0.4, marginTop: 8 },
  details: { color: '#71717a', fontSize: 13, lineHeight: 20, marginTop: 8 },
});
