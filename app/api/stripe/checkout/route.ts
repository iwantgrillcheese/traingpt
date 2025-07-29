// app/api/stripe/checkout/route.ts
import { NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { stripe } from '@/utils/stripe';

export async function POST() {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single();

  const customer =
    profile?.stripe_customer_id ||
    (await stripe.customers.create({ email: user.email! })).id;

  const session = await stripe.checkout.sessions.create({
    customer,
    mode: 'subscription',
    line_items: [
      {
        price: process.env.STRIPE_PRICE_ID!, // <- store in Vercel as STRIPE_PRICE_ID
        quantity: 1,
      },
    ],
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/schedule?upgraded=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/schedule`,
  });

  if (!profile?.stripe_customer_id) {
    await supabase
      .from('profiles')
      .update({ stripe_customer_id: customer })
      .eq('id', user.id);
  }

  return NextResponse.json({ url: session.url });
}
