import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow } from '../design/theme';
import type { CompletedSessionRow, SessionRow } from '../types';
import { cleanTitle, formatDay, formatMinutes, getCompletionStatus, normalizeSport } from '../utils/training';

type Props = {
  session: SessionRow;
  completed?: CompletedSessionRow[];
  onPress?: () => void;
};

function sportInitial(value?: string | null) {
  const sport = normalizeSport(value);
  if (sport === 'Swim') return 'S';
  if (sport === 'Bike') return 'B';
  if (sport === 'Run') return 'R';
  if (sport === 'Brick') return 'Br';
  if (sport === 'Strength') return 'St';
  if (sport === 'Rest') return '⋯';
  return '•';
}

export function SessionCard({ session, completed = [], onPress }: Props) {
  const status = getCompletionStatus(session, completed);
  const duration = formatMinutes(session.duration);
  const sport = normalizeSport(session.sport);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Text style={styles.iconText}>{sportInitial(session.sport)}</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.headerRow}>
            <Text style={styles.meta}>{formatDay(session.date)} · {sport}{duration ? ` · ${duration}` : ''}</Text>
            {status ? <Text style={[styles.status, status === 'done' ? styles.done : styles.skipped]}>{status === 'done' ? 'Done' : 'Skipped'}</Text> : null}
          </View>
          <Text style={styles.title}>{cleanTitle(session.title)}</Text>
          {session.details ? <Text numberOfLines={2} style={styles.details}>{session.details.replace(/Purpose:|Workout:|Intensity:/gi, '').trim()}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 10,
    ...shadow.card,
  },
  pressed: { transform: [{ scale: 0.992 }], opacity: 0.92 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  content: { flex: 1, minWidth: 0 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  meta: { color: colors.muted, fontSize: 12, fontWeight: '700', flex: 1 },
  status: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, fontSize: 11, fontWeight: '800' },
  done: { backgroundColor: colors.ink, color: colors.surface },
  skipped: { backgroundColor: colors.surfaceMuted, color: colors.muted },
  title: { color: colors.ink, fontSize: 18, fontWeight: '800', letterSpacing: -0.5, marginTop: 7 },
  details: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 7 },
});
