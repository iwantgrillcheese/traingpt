import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, sportColors } from '../design/theme';
import type { CompletedSessionRow, SessionRow } from '../types';
import { cleanTitle, formatDay, formatMinutes, getCompletionStatus, normalizeSport } from '../utils/training';

type Props = {
  session: SessionRow;
  completed?: CompletedSessionRow[];
  onPress?: () => void;
  featured?: boolean;
};

function sportIcon(value?: string | null) {
  const sport = normalizeSport(value);
  if (sport === 'Swim') return '≈';
  if (sport === 'Bike') return '◌';
  if (sport === 'Run') return '⌁';
  if (sport === 'Brick') return '↯';
  if (sport === 'Strength') return '▣';
  if (sport === 'Rest') return '·';
  return '•';
}

function statusLabel(status: string | null) {
  if (status === 'done') return 'Completed';
  if (status === 'skipped') return 'Skipped';
  return 'Planned';
}

export function SessionCard({ session, completed = [], onPress, featured = false }: Props) {
  const status = getCompletionStatus(session, completed);
  const duration = formatMinutes(session.duration);
  const sport = normalizeSport(session.sport);
  const accent = sportColors[sport as keyof typeof sportColors] ?? colors.ink;
  const isCompleted = status === 'done';

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, featured && styles.featuredCard, pressed && styles.pressed]}>
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: `${accent}12`, borderColor: `${accent}25` }]}>
          <Text style={[styles.iconText, { color: accent }]}>{sportIcon(session.sport)}</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.headerRow}>
            <Text style={styles.meta}>{formatDay(session.date)}{duration ? ` · ${duration}` : ''}</Text>
            <Text style={[styles.status, isCompleted ? styles.done : styles.planned]}>{statusLabel(status)}</Text>
          </View>
          <Text style={styles.title}>{cleanTitle(session.title)}</Text>
          {session.details ? <Text numberOfLines={featured ? 3 : 2} style={styles.details}>{session.details.replace(/Purpose:|Workout:|Intensity:/gi, '').trim()}</Text> : null}
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
  featuredCard: { borderColor: '#ead7c2', backgroundColor: '#fffdf9' },
  pressed: { transform: [{ scale: 0.992 }], opacity: 0.92 },
  row: { flexDirection: 'row', gap: 13, alignItems: 'flex-start' },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 18, fontWeight: '900' },
  content: { flex: 1, minWidth: 0 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  meta: { color: colors.muted, fontSize: 12, fontWeight: '700', flex: 1 },
  status: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, fontSize: 11, fontWeight: '900' },
  done: { backgroundColor: colors.purpleSoft, color: colors.purple },
  planned: { backgroundColor: colors.successSoft, color: colors.success },
  title: { color: colors.ink, fontSize: 19, fontWeight: '900', letterSpacing: -0.7, marginTop: 7 },
  details: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 6 },
});
