import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, sportColors } from '../design/theme';
import type { CompletedSessionRow, SessionRow, StravaActivityRow } from '../types';
import { cleanTitle, formatDay, formatMinutes, getCompletionStatus, normalizeSport } from '../utils/training';
import { getSessionPoints, getSessionPriority } from '../utils/sessionPoints';
import { sessionHasSameDayStravaMatch } from '../utils/stravaMatching';

type Props = {
  session: SessionRow;
  completed?: CompletedSessionRow[];
  stravaActivities?: StravaActivityRow[];
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

function statusLabel(status: string | null, viaStrava: boolean) {
  if (status === 'done') return viaStrava ? 'Via Strava' : 'Completed';
  if (status === 'skipped') return 'Skipped';
  return 'Planned';
}

function priorityLabel(priority: string) {
  if (priority === 'key') return 'Key';
  if (priority === 'light') return 'Light';
  return 'Base';
}

export function SessionCard({ session, completed = [], stravaActivities = [], onPress, featured = false }: Props) {
  const status = getCompletionStatus(session, completed);
  const duration = formatMinutes(session.duration);
  const sport = normalizeSport(session.sport);
  const accent = sportColors[sport as keyof typeof sportColors] ?? colors.ink;
  const isCompleted = status === 'done';
  const viaStrava = isCompleted && sessionHasSameDayStravaMatch(session, stravaActivities);
  const points = getSessionPoints(session);
  const priority = getSessionPriority(session);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, featured && styles.featuredCard, viaStrava && styles.stravaCard, pressed && styles.pressed]}>
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: `${accent}12`, borderColor: `${accent}25` }]}>
          <Text style={[styles.iconText, { color: accent }]}>{sportIcon(session.sport)}</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.headerRow}>
            <Text style={styles.meta}>{formatDay(session.date)}{duration ? ` · ${duration}` : ''}</Text>
            <Text style={[styles.status, isCompleted ? styles.done : styles.planned, viaStrava && styles.stravaDone]}>{statusLabel(status, viaStrava)}</Text>
          </View>
          <Text style={styles.title}>{cleanTitle(session.title)}</Text>
          <View style={styles.pointsRow}>
            <Text style={[styles.pointsPill, priority === 'key' && styles.keyPill]}>{points} pts</Text>
            <Text style={styles.priorityPill}>{priorityLabel(priority)}</Text>
            {viaStrava ? <Text style={styles.stravaPill}>Synced</Text> : null}
          </View>
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
  stravaCard: { borderColor: '#bfdbfe', backgroundColor: '#f8fbff' },
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
  stravaDone: { backgroundColor: colors.blueSoft, color: colors.blue },
  planned: { backgroundColor: colors.successSoft, color: colors.success },
  title: { color: colors.ink, fontSize: 19, fontWeight: '900', letterSpacing: -0.7, marginTop: 7 },
  pointsRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  pointsPill: { overflow: 'hidden', borderRadius: 999, backgroundColor: colors.surfaceMuted, color: colors.ink, paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: '900' },
  keyPill: { backgroundColor: colors.successSoft, color: colors.success },
  priorityPill: { overflow: 'hidden', borderRadius: 999, backgroundColor: colors.cream, color: colors.muted, paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: '900' },
  stravaPill: { overflow: 'hidden', borderRadius: 999, backgroundColor: colors.blueSoft, color: colors.blue, paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: '900' },
  details: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 6 },
});
