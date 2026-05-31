import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { apiFetch } from '../lib/api';

type RaceType = 'Sprint' | 'Olympic' | 'Half Ironman (70.3)' | 'Ironman (140.6)';
type Experience = 'Beginner' | 'Intermediate' | 'Advanced';

const raceTypes: RaceType[] = ['Sprint', 'Olympic', 'Half Ironman (70.3)', 'Ironman (140.6)'];
const experiences: Experience[] = ['Beginner', 'Intermediate', 'Advanced'];
const restDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function defaultRaceDate() {
  const date = new Date();
  date.setDate(date.getDate() + 16 * 7);
  return date.toISOString().slice(0, 10);
}

export function PlanScreen() {
  const { user } = useAuth();
  const [raceType, setRaceType] = useState<RaceType>('Half Ironman (70.3)');
  const [raceDate, setRaceDate] = useState(defaultRaceDate());
  const [experience, setExperience] = useState<Experience>('Intermediate');
  const [maxHours, setMaxHours] = useState('8');
  const [restDay, setRestDay] = useState('Monday');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generatePlan = async () => {
    if (!user?.id) return;

    const hours = Number(maxHours);
    if (!raceDate || !Number.isFinite(hours) || hours <= 0) {
      setError('Enter a valid race date and weekly training hours.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await apiFetch('/api/finalize-plan', {
        method: 'POST',
        body: JSON.stringify({
          raceType,
          raceDate,
          experience,
          maxHours: hours,
          restDay,
          planType: 'triathlon',
          athleteNotes: notes.trim() || undefined,
          twoADaysAllowed: false,
          clientUserId: user.id,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok || payload?.ok === false) {
        setError(payload?.error || 'Could not generate your plan.');
        return;
      }

      setSuccess('Plan generated. Open Today or Schedule and pull to refresh.');
    } catch (err) {
      console.error('[PlanScreen] plan generation failed', err);
      setError('Could not reach TrainGPT. Try again in a moment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.kicker}>Plan</Text>
        <Text style={styles.title}>Build your training plan.</Text>
        <Text style={styles.subtitle}>Native v1 keeps this simple: goal, date, experience, weekly hours, and rest day. Advanced power/pace inputs come next.</Text>

        <View style={styles.section}>
          <Text style={styles.label}>Race type</Text>
          <View style={styles.options}>
            {raceTypes.map((option) => (
              <Pressable key={option} onPress={() => setRaceType(option)} style={[styles.option, raceType === option && styles.optionActive]}>
                <Text style={[styles.optionText, raceType === option && styles.optionTextActive]}>{option}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Race date</Text>
          <TextInput value={raceDate} onChangeText={setRaceDate} placeholder="YYYY-MM-DD" placeholderTextColor="#a1a1aa" autoCapitalize="none" style={styles.input} />
          <Text style={styles.help}>Use YYYY-MM-DD for now. Native date picker comes after the core loop works.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Experience</Text>
          <View style={styles.options}>
            {experiences.map((option) => (
              <Pressable key={option} onPress={() => setExperience(option)} style={[styles.option, experience === option && styles.optionActive]}>
                <Text style={[styles.optionText, experience === option && styles.optionTextActive]}>{option}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.sectionGrid}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Weekly hours</Text>
            <TextInput value={maxHours} onChangeText={setMaxHours} keyboardType="decimal-pad" placeholder="8" placeholderTextColor="#a1a1aa" style={styles.input} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Rest day</Text>
            <View style={styles.compactOptions}>
              {restDays.map((option) => (
                <Pressable key={option} onPress={() => setRestDay(option)} style={[styles.compactOption, restDay === option && styles.optionActive]}>
                  <Text style={[styles.compactOptionText, restDay === option && styles.optionTextActive]}>{option.slice(0, 3)}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Coach notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Anything your coach should know?"
            placeholderTextColor="#a1a1aa"
            multiline
            style={[styles.input, styles.textArea]}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}

        <Pressable disabled={loading} onPress={generatePlan} style={[styles.button, loading && styles.disabled]}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Generate plan</Text>}
        </Pressable>

        <Text style={styles.footerNote}>Long plans can take a minute. Keep the app open while TrainGPT builds the calendar.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fbfbfa' },
  content: { padding: 20, paddingTop: 72, paddingBottom: 130 },
  kicker: { color: '#71717a', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.8 },
  title: { marginTop: 8, color: '#09090b', fontSize: 38, lineHeight: 38, fontWeight: '800', letterSpacing: -1.8 },
  subtitle: { marginTop: 10, color: '#71717a', fontSize: 14, lineHeight: 22 },
  section: { marginTop: 22 },
  sectionGrid: { marginTop: 22, flexDirection: 'row', gap: 12 },
  label: { marginBottom: 8, color: '#3f3f46', fontSize: 13, fontWeight: '800' },
  options: { gap: 8 },
  option: { minHeight: 48, borderRadius: 18, borderWidth: 1, borderColor: '#e4e4e7', backgroundColor: '#fff', paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  optionActive: { backgroundColor: '#09090b', borderColor: '#09090b' },
  optionText: { color: '#3f3f46', fontWeight: '800' },
  optionTextActive: { color: '#fff' },
  compactOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  compactOption: { minWidth: 42, minHeight: 40, borderRadius: 14, borderWidth: 1, borderColor: '#e4e4e7', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  compactOptionText: { color: '#3f3f46', fontSize: 12, fontWeight: '800' },
  input: { minHeight: 52, borderRadius: 18, borderWidth: 1, borderColor: '#e4e4e7', backgroundColor: '#fff', paddingHorizontal: 16, color: '#09090b', fontSize: 16 },
  textArea: { minHeight: 96, paddingTop: 14, textAlignVertical: 'top' },
  help: { marginTop: 8, color: '#a1a1aa', fontSize: 12, lineHeight: 18 },
  error: { marginTop: 16, color: '#be123c', fontWeight: '800', lineHeight: 20 },
  success: { marginTop: 16, color: '#166534', fontWeight: '800', lineHeight: 20 },
  button: { marginTop: 20, minHeight: 56, borderRadius: 20, backgroundColor: '#09090b', alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.65 },
  footerNote: { marginTop: 12, color: '#71717a', fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
