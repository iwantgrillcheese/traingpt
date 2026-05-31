import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, spacing } from '../design/theme';

const gearItems = [
  { title: 'Race kit', text: 'Wetsuit, goggles, helmet, shoes, nutrition, and flat kit.' },
  { title: 'Bike readiness', text: 'Tires, chain, brake check, batteries, and race-day spares.' },
  { title: 'Fueling plan', text: 'Carbs, fluids, sodium, caffeine, and what to practice before race week.' },
];

export function GearScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.kicker}>Gear & nutrition</Text>
      <Text style={styles.title}>Race prep that does not live in your head.</Text>
      <Text style={styles.subtitle}>Equipment, fueling, reminders, and race-week checklists will live here.</Text>

      <View style={styles.heroCard}>
        <Text style={styles.cardKicker}>Coming into focus</Text>
        <Text style={styles.cardTitle}>Fueling, equipment, and prep become part of the plan.</Text>
        <Text style={styles.cardText}>The calendar gets you fit. This tab helps you show up prepared.</Text>
      </View>

      {gearItems.map((item) => (
        <View key={item.title} style={styles.itemCard}>
          <Text style={styles.itemTitle}>{item.title}</Text>
          <Text style={styles.itemText}>{item.text}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.pageX, paddingTop: 64, paddingBottom: 132 },
  kicker: { color: colors.faint, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.8 },
  title: { marginTop: 12, color: colors.ink, fontSize: 40, lineHeight: 41, fontWeight: '900', letterSpacing: -2 },
  subtitle: { marginTop: 14, color: colors.inkSoft, fontSize: 16, lineHeight: 25, fontWeight: '500' },
  heroCard: { marginTop: 28, backgroundColor: colors.ink, borderRadius: radius.xl, padding: 20, ...shadow.hero },
  cardKicker: { color: '#a1a1aa', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.4 },
  cardTitle: { marginTop: 14, color: colors.surface, fontSize: 26, lineHeight: 29, fontWeight: '900', letterSpacing: -1 },
  cardText: { marginTop: 10, color: '#d4d4d8', fontSize: 14, lineHeight: 22, fontWeight: '600' },
  itemCard: { marginTop: 12, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 18, ...shadow.card },
  itemTitle: { color: colors.ink, fontSize: 20, fontWeight: '900', letterSpacing: -0.7 },
  itemText: { marginTop: 8, color: colors.muted, fontSize: 14, lineHeight: 22, fontWeight: '600' },
});
