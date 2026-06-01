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

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <View style={[styles.tabIcon, focused && styles.tabIconActive]}>
      <Text style={[styles.tabIconText, focused && styles.tabIconTextActive]}>{label}</Text>
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
      <Tab.Screen name="Today" component={TodayScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon label="T" focused={focused} /> }} />
      <Tab.Screen name="Schedule" component={ScheduleScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon label="S" focused={focused} /> }} />
      <Tab.Screen name="Fitness" component={ProgressScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon label="F" focused={focused} /> }} />
      <Tab.Screen name="Settings" component={GearScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon label="Set" focused={focused} /> }} />
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
  tabIconText: { color: colors.muted, fontSize: 10, fontWeight: '900' },
  tabIconTextActive: { color: colors.surface },
});
