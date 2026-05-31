import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { LoginScreen } from './screens/LoginScreen';
import { TodayScreen } from './screens/TodayScreen';
import { ScheduleScreen } from './screens/ScheduleScreen';
import { CoachScreen } from './screens/CoachScreen';
import { ProgressScreen } from './screens/ProgressScreen';
import { GearScreen } from './screens/GearScreen';
import { colors } from './design/theme';

type RootTabs = {
  Today: undefined;
  Schedule: undefined;
  Coach: undefined;
  Progress: undefined;
  Gear: undefined;
};

const Tab = createBottomTabNavigator<RootTabs>();

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
      <Text style={styles.loadingText}>Opening your training room…</Text>
    </View>
  );
}

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <View style={[styles.tabIcon, focused && styles.tabIconActive]}>
      <Text style={[styles.tabIconText, focused && styles.tabIconTextActive]}>{label}</Text>
    </View>
  );
}

function AuthedTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.faint,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabItem,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen name="Today" component={TodayScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon label="T" focused={focused} /> }} />
      <Tab.Screen name="Schedule" component={ScheduleScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon label="S" focused={focused} /> }} />
      <Tab.Screen name="Coach" component={CoachScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon label="C" focused={focused} /> }} />
      <Tab.Screen name="Progress" component={ProgressScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon label="P" focused={focused} /> }} />
      <Tab.Screen name="Gear" component={GearScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon label="G" focused={focused} /> }} />
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
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  loadingMark: { width: 54, height: 54, borderRadius: 18, backgroundColor: colors.ink, marginBottom: 18 },
  loadingText: { marginTop: 12, color: colors.muted, fontWeight: '800' },
  tabBar: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    height: 76,
    borderRadius: 28,
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.96)',
    paddingTop: 8,
    paddingBottom: 12,
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  tabItem: { paddingVertical: 2 },
  tabLabel: { fontSize: 10, fontWeight: '900', marginTop: 2 },
  tabIcon: {
    width: 26,
    height: 26,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  tabIconActive: { backgroundColor: colors.ink },
  tabIconText: { color: colors.muted, fontSize: 11, fontWeight: '900' },
  tabIconTextActive: { color: colors.surface },
});
