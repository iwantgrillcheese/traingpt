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
    <View style={[styles.tabIcon, focused && styles.tabIconActive]}>
      <Text style={[styles.tabIconText, focused && styles.tabIconTextActive]}>{icon}</Text>
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
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 84,
    borderRadius: 0,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderWidth: 0,
    backgroundColor: 'rgba(255,255,255,0.98)',
    paddingTop: 8,
    paddingBottom: 20,
    shadowColor: colors.ink,
    shadowOpacity: 0.07,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -8 },
    elevation: 10,
  },
  tabItem: { paddingVertical: 2 },
  tabLabel: { fontSize: 10, fontWeight: '900', marginTop: 2 },
  tabIcon: {
    width: 29,
    height: 29,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  tabIconActive: { backgroundColor: colors.ink },
  tabIconText: { color: colors.muted, fontSize: 14, fontWeight: '900' },
  tabIconTextActive: { color: colors.surface },
});
