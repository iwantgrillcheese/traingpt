import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { AuthedExperience } from './components/AuthedExperience';
import { LoginScreen } from './screens/LoginScreen';
import { colors } from './design/theme';

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.ink,
    border: colors.border,
    primary: colors.ink,
  },
};

function LoadingScreen() {
  return (
    <View style={styles.loading}>
      <View style={styles.loadingMark} />
      <ActivityIndicator />
      <Text style={styles.loadingText}>Opening your training room...</Text>
    </View>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  return user ? <AuthedExperience /> : <LoginScreen />;
}

export default function RootApp() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer theme={theme}>
          <StatusBar style="dark" />
          <AppContent />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  loadingMark: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: colors.ink,
    marginBottom: 18,
  },
  loadingText: {
    marginTop: 12,
    color: colors.muted,
    fontWeight: '800',
  },
});
