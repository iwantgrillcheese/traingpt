import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow } from '../design/theme';
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

function statusLabel(status: string | null, viaStrava: boolean) {
  if (status === 'done') return viaStrava ? 'Via Strava' : 'Completed';
  if (status === 'skipped') return 'Skipped';
  return 'Planned';
}

function priorityLabel(priority: string) {
  if (priority === 'key') return 'Key session';
  if (priority === 'light') return 'Light';
  return 'Base';
}

export function SessionCard({ session, completed = [], stravaActivities = [], onPress, featured = false }: Props) {
  const status = getCompletionStatus(session, completed);
  const duration = formatMinutes(session.duration);
  const sport = normalizeSport(session.sport);
  const isCompleted = status === 'done';
  const viaStrava = isCompleted && sessionHasSameDayStravaMatch(session, stravaActivities);
  const points = getSessionPoints(session);
  const priority = getSessionPriority(session);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, featured && styles.featuredCard, viaStrava && styles.stravaCard, pressed && styles.pressed]}>
      <View style={styles.headerRow}>
        <Text style={styles.meta} numberOfLines={1}>{formatDay(session.date)}{duration ? ` · ${duration}` : ''} · {sport}</Text>
        <Text style={[styles.status, isCompleted ? styles.done : styles.planned, viaStrava && styles.stravaDone]}>{statusLabel(status, viaStrava)}</Text>
      </View>

      <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">{cleanTitle(session.title)}</Text>

      <View style={styles.pointsRow}>
        <Text style={[styles.pointsPill, priority === 'key' && styles.keyPill]}>{points} pts</Text>
        <Text style={styles.priorityPill}>{priorityLabel(priority)}</Text>
        {viaStrava ? <Text style={styles.stravaPill}>Synced</Text> : null}
      </View>

      {session.details ? <Text numberOfLines={featured ? 3 : 2} ellipsizeMode="tail" style={styles.details}>{session.details.replace(/Purpose:|Workout:|Intensity:/gi, '').trim()}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: 15,
    marginBottom: 10,
    ...shadow.card,
  },
  featuredCard: { borderColor: colors.border, backgroundColor: colors.surface },
  stravaCard: { borderColor: '#c7d7ef', backgroundColor: '#f8fbff' },
  pressed: { transform: [{ scale: 0.992 }], opacity: 0.92 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  meta: { color: colors.muted, fontSize: 12, fontWeight: '600', flex: 1 },
  status: { overflow: 'hidden', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, fontSize: 11, fontWeight: '700' },
  done: { backgroundColor: colors.successSoft, color: colors.success },
  stravaDone: { backgroundColor: colors.blueSoft, color: colors.blue },
  planned: { backgroundColor: colors.surfaceMuted, color: colors.muted },
  title: { color: colors.ink, fontSize: 18, lineHeight: 23, fontWeight: '800', letterSpacing: -0.45, marginTop: 8 },
  pointsRow: { marginTop: 9, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  pointsPill: { overflow: 'hidden', borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, color: colors.inkSoft, paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: '700' },
  keyPill: { backgroundColor: colors.successSoft, color: colors.success },
  priorityPill: { overflow: 'hidden', borderRadius: radius.pill, backgroundColor: colors.cream, color: colors.muted, paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: '700' },
  stravaPill: { overflow: 'hidden', borderRadius: radius.pill, backgroundColor: colors.blueSoft, color: colors.blue, paddingHorizontal: 9, paddingVertical: 5, fontSize: 11, fontWeight: '700' },
  details: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 7, fontWeight: '500' },
});
