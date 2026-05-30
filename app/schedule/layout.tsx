import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { AuthError, createServerSupabaseClient, requireUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type ScheduleLayoutProps = {
  children: ReactNode;
};

export default async function ScheduleLayout({ children }: ScheduleLayoutProps) {
  const supabase = await createServerSupabaseClient();

  let userId: string;

  try {
    const user = await requireUser(supabase);
    userId = user.id;
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/login?next=${encodeURIComponent('/schedule')}`);
    }

    throw error;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('stripe_subscription_active')
    .eq('id', userId)
    .maybeSingle();

  if (profileError) {
    console.error('[schedule/layout] profile lookup failed', profileError);
  }

  const hasActiveSubscription = Boolean((profile as any)?.stripe_subscription_active);

  if (!hasActiveSubscription) {
    const { data: latestPlan, error: latestPlanError } = await supabase
      .from('plans')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestPlanError) {
      console.error('[schedule/layout] latest plan lookup failed', latestPlanError);
    }

    if (latestPlan?.id) {
      redirect(`/plan-preview/${latestPlan.id}`);
    }

    redirect('/plan');
  }

  return children;
}
