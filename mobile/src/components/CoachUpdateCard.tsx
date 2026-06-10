// /mobile/src/components/CoachUpdateCard.tsx
//
// The adaptive loop's surface on the phone: shows the latest Sunday
// adaptation (summary + expandable diff) on the Today screen. Renders
// nothing when there's nothing to say.

import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, typography } from '../design/theme';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';

type AdaptationChange = {
  date: string;
  sport: string;
  title: string;
  change: string;
  from: string;
  to: string;
  reason: string;
};

type AdaptationRow = {
  id: string;
  summary: string | null;
  changes: AdaptationChange[] | null;
  week_start: string | null;
  created_at: string;
};

const SHOW_FOR_DAYS = 8;

export function CoachUpdateCard() {
  const { user } = useAuth();
  const [adaptation, setAdaptation] = useState<AdaptationRow | null>(null);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const since = new Date(Date.now() - SHOW_FOR_DAYS * 86400000).toISOString();
      const { data } = await supabase
        .from('plan_adaptations')
        .select('id,summary,changes,week_start,created_at')
        .eq('user_id', user.id)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1);
      setAdaptation(((data ?? [])[0] as AdaptationRow | undefined) ?? null);
    } catch (error) {
      // Quietly absent is the correct failure mode for an ambient card.
      console.error('[CoachUpdateCard] load failed', error);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const changes = Array.isArray(adaptation?.changes) ? (adaptation?.changes as AdaptationChange[]) : [];

  if (!adaptation?.summary) return null;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.kicker}>Coach update</Text>
        {changes.length ? (
          <Pressable onPress={() => setExpanded((value) => !value)} hitSlop={8}>
            <Text style={styles.toggle}>{expanded ? 'Hide' : `${changes.length} change${changes.length === 1 ? '' : 's'}`}</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.summary}>{adaptation.summary}</Text>

      {expanded && changes.length ? (
        <View style={styles.changes}>
          {changes.map((change, index) => (
            <View key={index} style={styles.changeRow}>
              <Text style={styles.changeTitle}>
                {change.change === 'downgraded_intensity' ? change.from : change.title} · {change.from} → {change.to}
              </Text>
              <Text style={styles.changeReason}>{change.reason}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderLeftColor: colors.topography,
    borderRadius: radius.card,
    padding: 16,
    ...shadow.card,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  kicker: { ...typography.kicker, color: colors.faint },
  toggle: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  summary: { marginTop: 8, color: colors.inkSoft, fontSize: 14, lineHeight: 21, fontWeight: '500' },
  changes: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, gap: 10 },
  changeRow: {},
  changeTitle: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  changeReason: { marginTop: 2, color: colors.muted, fontSize: 12, lineHeight: 18, fontWeight: '500' },
});
