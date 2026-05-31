import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { LoginScreen } from './screens/LoginScreen';
import { TodayScreen } from './screens/TodayScreen';
import { PlanScreen } from './screens/PlanScreen';
import { ScheduleScreen } from './screens/ScheduleScreen';
import { CoachScreen } from './screens/CoachScreen';
import { ProgressScreen } from './screens/ProgressScreen';
import { SettingsScreen } from './screens/SettingsScreen';

type RootTabs = {
  Today: undefined;
  Plan: undefined;
  Schedule: undefined;
  Coach: undefined;
  Progress: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabs>();

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#fbfbfa',
    card: '#ffffff',
    text: '#09090b',
    border: '#e4e4e7',
    primary: '#09090b',
  },
};

function LoadingScreen() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator />
      <Text style={styles.loadingText}>Opening TrainGPT…</Text>
    </View>
  );
}

function AuthedTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#09090b',
        tabBarInactiveTintColor: '#a1a1aa',
        tabBarStyle: {
          borderTopColor: '#e4e4e7',
          backgroundColor: '#ffffff',
          height: 86,
          paddingTop: 8,
          paddingBottom: 24,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '800',
        },
      }}
    >
      <Tab.Screen name="Today" component={TodayScreen} options={{ tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>●</Text> }} />
      <Tab.Screen name="Plan" component={PlanScreen} options={{ tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>＋</Text> }} />
      <Tab.Screen name="Schedule" component={ScheduleScreen} options={{ tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>◼</Text> }} />
      <Tab.Screen name="Coach" component={CoachScreen} options={{ tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>◆</Text> }} />
      <Tab.Screen name="Progress" component={ProgressScreen} options={{ tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>▲</Text> }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarIcon: ({ color }) => <Text style={[styles.icon, { color }]}>◯</Text> }} />
    </Tab.Navigator>
  );
}

function AppContent() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return user ? <AuthedTabs /> : <LoginScreen />;
}

export default function App() {
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
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fbfbfa' },
  loadingText: { marginTop: 10, color: '#71717a', fontWeight: '700' },
  icon: { fontSize: 14, fontWeight: '900' },
});
