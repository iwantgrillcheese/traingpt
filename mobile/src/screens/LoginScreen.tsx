import { StyleSheet, Text, View } from 'react-native';

export function LoginScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.kicker}>TrainGPT iOS</Text>
        <Text style={styles.title}>Native app foundation is ready.</Text>
        <Text style={styles.subtitle}>Email, Google, and Apple sign-in will be wired in the next mobile auth pass.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fbfaf8', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 32, padding: 24, borderWidth: 1, borderColor: '#e4e4e7' },
  kicker: { color: '#71717a', fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.8 },
  title: { marginTop: 14, color: '#09090b', fontSize: 36, lineHeight: 36, fontWeight: '800', letterSpacing: -1.8 },
  subtitle: { marginTop: 14, color: '#71717a', fontSize: 14, lineHeight: 22 },
});
