import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getStripeClient } from '@/utils/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getServiceSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

function subscriptionIsActive(status?: string | null) {
  return status === 'active' || status === 'trialing';
}

export async function POST(req: Request) {
  try {
    const { sessionId, planId } = await req.json();

    if (typeof sessionId !== 'string' || !sessionId.trim()) {
      return NextResponse.json({ ok: false, error: 'Missing checkout session.' }, { status: 400 });
    }

    const stripe = getStripeClient();
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    const customerId = typeof checkoutSession.customer === 'string' ? checkoutSession.customer : null;
    const subscription = checkoutSession.subscription;
    const subscriptionId = typeof subscription === 'string' ? subscription : subscription?.id ?? null;
    const subscriptionStatus = typeof subscription === 'string' ? null : subscription?.status ?? null;
    const active = checkoutSession.payment_status === 'paid' || subscriptionIsActive(subscriptionStatus);
    const userId = typeof checkoutSession.metadata?.userId === 'string' ? checkoutSession.metadata.userId : null;
    const sessionPlanId = typeof checkoutSession.metadata?.planId === 'string' ? checkoutSession.metadata.planId : null;
    const resolvedPlanId = typeof planId === 'string' && planId.trim() ? planId.trim() : sessionPlanId;

    if (!customerId || !subscriptionId) {
      return NextResponse.json({ ok: false, error: 'Checkout session is missing billing details.' }, { status: 400 });
    }

    if (!active) {
      return NextResponse.json({ ok: false, error: 'Payment is not complete yet.' }, { status: 402 });
    }

    const supabase = getServiceSupabase();

    const updatePayload = {
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      stripe_subscription_active: true,
    };

    if (userId) {
      const { error } = await supabase.from('profiles').update(updatePayload).eq('id', userId);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('stripe_customer_id', customerId);
      if (error) throw error;
    }

    return NextResponse.json({
      ok: true,
      planId: resolvedPlanId ?? null,
      scheduleUrl: `/schedule?upgraded=true${resolvedPlanId ? `&planId=${encodeURIComponent(resolvedPlanId)}` : ''}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to confirm checkout.';
    console.error('[stripe/confirm-session] failed', err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
