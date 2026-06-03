import { useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, Text, View } from 'react-native';
import { TodayScreen } from '../screens/TodayScreen';
import { ScheduleScreen } from '../screens/ScheduleScreen';
import { ProgressScreen } from '../screens/ProgressScreen';
import { GearScreen } from '../screens/GearScreen';
import { OnboardingGate } from './OnboardingGate';
import { PostPlanTour } from './PostPlanTour';
import { colors } from '../design/theme';

type RootTabs = {
  Today: undefined;
  Schedule: undefined;
  Fitness: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabs>();

function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return (
    <View style={styles.tabIcon}>
      <Text style={[styles.tabIconText, focused && styles.tabIconTextActive]}>{icon}</Text>
      {focused ? <View style={styles.activeDot} /> : null}
    </View>
  );
}

function CoreTabs({ initialRouteName }: { initialRouteName: keyof RootTabs }) {
  return (
    <Tab.Navigator
      key={initialRouteName}
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.faint,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabItem,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen name="Today" component={TodayScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon icon="⌂" focused={focused} /> }} />
      <Tab.Screen name="Schedule" component={ScheduleScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon icon="□" focused={focused} /> }} />
      <Tab.Screen name="Fitness" component={ProgressScreen} options={{ title: 'Readiness', tabBarIcon: ({ focused }) => <TabIcon icon="◷" focused={focused} /> }} />
      <Tab.Screen name="Settings" component={GearScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon icon="⚙" focused={focused} /> }} />
    </Tab.Navigator>
  );
}

export function AuthedExperience() {
  const [initialTab, setInitialTab] = useState<keyof RootTabs>('Today');
  const [showPostPlanTour, setShowPostPlanTour] = useState(false);

  const handlePlanCreated = () => {
    setInitialTab('Schedule');
    setShowPostPlanTour(true);
  };

  const openToday = () => {
    setInitialTab('Today');
    setShowPostPlanTour(false);
  };

  const openSchedule = () => {
    setInitialTab('Schedule');
    setShowPostPlanTour(false);
  };

  return (
    <OnboardingGate onPlanCreated={handlePlanCreated}>
      <CoreTabs initialRouteName={initialTab} />
      <PostPlanTour visible={showPostPlanTour} onOpenToday={openToday} onOpenSchedule={openSchedule} />
    </OnboardingGate>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 78,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingTop: 6,
    paddingBottom: 16,
    shadowColor: colors.ink,
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -6 },
    elevation: 4,
  },
  tabItem: { paddingVertical: 2 },
  tabLabel: { fontSize: 10, fontWeight: '700', marginTop: 1 },
  tabIcon: {
    width: 32,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconText: { color: colors.faint, fontSize: 16, fontWeight: '700' },
  tabIconTextActive: { color: colors.ink },
  activeDot: {
    position: 'absolute',
    bottom: 0,
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.ink,
  },
});
