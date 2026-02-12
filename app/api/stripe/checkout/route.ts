import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { getStripeClient } from '@/utils/stripe';

export async function POST() {
  try {
    const supabase = createServerComponentClient({ cookies });

    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();

    if (authError || !session?.user) {
      console.error('[Stripe Checkout] Unauthorized', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('[Stripe Checkout] Failed to fetch profile:', profileError);
      return NextResponse.json({ error: 'Profile not found' }, { status: 500 });
    }

    const stripe = getStripeClient();

    const customerId =
      profile?.stripe_customer_id ||
      (await stripe.customers.create({ email: user.email! })).id;

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    if (!baseUrl) {
      throw new Error('Missing NEXT_PUBLIC_BASE_URL in env');
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
      success_url: `${baseUrl}/schedule?upgraded=true`,
      cancel_url: `${baseUrl}/schedule`,
    });

    if (!profile?.stripe_customer_id) {
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error('[Stripe Checkout Error]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
