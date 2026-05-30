import type { SupabaseClient } from '@supabase/supabase-js';

export type BillingAccess = {
  isPlusActive: boolean;
};

export async function getBillingAccess(supabase: SupabaseClient, userId: string): Promise<BillingAccess> {
  const { data, error } = await supabase
    .from('profiles')
    .select('stripe_subscription_active')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('[billing] failed to load billing access', error);
    return { isPlusActive: false };
  }

  return { isPlusActive: Boolean((data as any)?.stripe_subscription_active) };
}

export function premiumFeatureResponse(feature: string, upgradeUrl = '/plan-preview') {
  return {
    error: `${feature} is included with TrainGPT Plus.`,
    code: 'PLUS_REQUIRED',
    feature,
    upgradeUrl,
  };
}
