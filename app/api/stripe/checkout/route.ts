import { NextResponse } from 'next/server';
import { AuthError, createRouteSupabaseClient, requireUser } from '@/lib/supabase/server';
import { getStripeClient } from '@/utils/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function buildReturnPath(planId?: string | null, status?: 'success' | 'cancelled') {
  const safePlanId = typeof planId === 'string' && planId.trim() ? planId.trim() : null;

  if (!safePlanId) {
    return status === 'success' ? '/schedule?upgraded=true' : '/schedule';
  }

  const suffix = status ? `?checkout=${status}` : '';
  return `/plan-preview/${encodeURIComponent(safePlanId)}${suffix}`;
}

export async function POST(req: Request) {
  try {
    const supabase = await createRouteSupabaseClient();
    const user = await requireUser(supabase);

    let planId: string | null = null;
    try {
      const body = await req.json();
      planId = typeof body?.planId === 'string' ? body.planId : null;
    } catch {
      planId = null;
    }

    if (planId) {
      const { data: planRow, error: planError } = await supabase
        .from('plans')
        .select('id')
        .eq('id', planId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (planError) throw planError;
      if (!planRow?.id) {
        return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
      }
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('[Stripe Checkout] Failed to fetch profile:', profileError);
      return NextResponse.json({ error: 'Profile not found' }, { status: 500 });
    }

    const stripe = getStripeClient();

    const customerId =
      profile?.stripe_customer_id ||
      (await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { userId: user.id },
      })).id;

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    if (!baseUrl) {
      throw new Error('Missing NEXT_PUBLIC_BASE_URL in env');
    }

    const stripePriceId = process.env.STRIPE_PRICE_ID;
    if (!stripePriceId) {
      throw new Error('Missing STRIPE_PRICE_ID in env');
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: stripePriceId, quantity: 1 }],
      success_url: `${baseUrl}${buildReturnPath(planId, 'success')}`,
      cancel_url: `${baseUrl}${buildReturnPath(planId, 'cancelled')}`,
      metadata: {
        userId: user.id,
        ...(planId ? { planId } : {}),
        product: 'traingpt_plus',
      },
      subscription_data: {
        metadata: {
          userId: user.id,
          ...(planId ? { planId } : {}),
          product: 'traingpt_plus',
        },
      },
    });

    if (!profile?.stripe_customer_id) {
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('[Stripe Checkout Error]', error);

    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
