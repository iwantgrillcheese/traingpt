import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { colors } from '../design/theme';
import { PlanScreen } from '../screens/PlanScreen';

type Props = {
  children: React.ReactNode;
  onPlanCreated?: () => void;
};

function CheckingPlanScreen() {
  return (
    <View style={styles.loading}>
      <View style={styles.loadingMark} />
      <ActivityIndicator />
      <Text style={styles.loadingText}>Checking your training plan...</Text>
    </View>
  );
}

export function OnboardingGate({ children, onPlanCreated }: Props) {
  const { user } = useAuth();
  const [checkingPlan, setCheckingPlan] = useState(true);
  const [hasPlan, setHasPlan] = useState(false);

  const checkForPlan = useCallback(async () => {
    if (!user?.id) return;
    setCheckingPlan(true);

    const { count, error } = await supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (error) {
      console.error('[OnboardingGate] plan check failed', error);
      setHasPlan(false);
    } else {
      setHasPlan((count ?? 0) > 0);
    }

    setCheckingPlan(false);
  }, [user?.id]);

  useEffect(() => {
    checkForPlan();
  }, [checkForPlan]);

  const handlePlanCreated = useCallback(() => {
    onPlanCreated?.();
    setHasPlan(true);
  }, [onPlanCreated]);

  if (checkingPlan) return <CheckingPlanScreen />;
  if (!hasPlan) return <PlanScreen onPlanCreated={handlePlanCreated} />;
  return <>{children}</>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  loadingMark: { width: 54, height: 54, borderRadius: 18, backgroundColor: colors.ink, marginBottom: 18 },
  loadingText: { marginTop: 12, color: colors.muted, fontWeight: '800' },
});
