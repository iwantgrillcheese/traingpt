import { NextResponse } from 'next/server';
import { AuthError, createRouteSupabaseClient, requireUser } from '@/lib/supabase/server';
import { getStripeClient } from '@/utils/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function buildSuccessPath(planId?: string | null) {
  const safePlanId = typeof planId === 'string' && planId.trim() ? planId.trim() : null;
  const planParam = safePlanId ? `&planId=${encodeURIComponent(safePlanId)}` : '';

  return `/payment/success?session_id={CHECKOUT_SESSION_ID}${planParam}`;
}

function buildCancelPath(planId?: string | null) {
  const safePlanId = typeof planId === 'string' && planId.trim() ? planId.trim() : null;

  if (!safePlanId) return '/schedule';
  return `/plan-preview/${encodeURIComponent(safePlanId)}?checkout=cancelled`;
}

function getInternalTestEmails() {
  return (process.env.STRIPE_INTERNAL_TEST_EMAILS ?? '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function shouldApplyInternalTestPromotion(email?: string | null) {
  const promotionCode = process.env.STRIPE_INTERNAL_TEST_PROMOTION_CODE_ID?.trim();
  if (!promotionCode || !email) return false;

  return getInternalTestEmails().includes(email.toLowerCase());
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

    const internalPromotionCodeId = shouldApplyInternalTestPromotion(user.email)
      ? process.env.STRIPE_INTERNAL_TEST_PROMOTION_CODE_ID?.trim()
      : undefined;

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: stripePriceId, quantity: 1 }],
      allow_promotion_codes: true,
      ...(internalPromotionCodeId
        ? {
            discounts: [{ promotion_code: internalPromotionCodeId }],
          }
        : {}),
      success_url: `${baseUrl}${buildSuccessPath(planId)}`,
      cancel_url: `${baseUrl}${buildCancelPath(planId)}`,
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
