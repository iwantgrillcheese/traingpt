import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { stripe } from '@/utils/stripe';
import Stripe from 'stripe';

// ✅ New syntax for Next.js 14+
export const routeSegmentConfig = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature');
  const body = await req.arrayBuffer();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      Buffer.from(body),
      sig!,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('[Webhook Error]', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = createServerComponentClient({ cookies });

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const customerId = session.customer as string;
    const subscriptionId = session.subscription as string;

    await supabase
      .from('profiles')
      .update({
        stripe_subscription_active: true,
        stripe_subscription_id: subscriptionId,
      })
      .eq('stripe_customer_id', customerId);
  }

  if (
    event.type === 'customer.subscription.deleted' ||
    event.type === 'invoice.payment_failed'
  ) {
    const subscription = event.data.object as Stripe.Subscription;

    await supabase
      .from('profiles')
      .update({ stripe_subscription_active: false })
      .eq('stripe_subscription_id', subscription.id);
  }

  return NextResponse.json({ received: true });
}
