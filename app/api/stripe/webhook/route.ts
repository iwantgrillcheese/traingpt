// app/api/stripe/webhook/route.ts
import { buffer } from 'micro';
import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/utils/stripe';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type Stripe from 'stripe';



export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature');
  const body = await req.arrayBuffer();
  let event;

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

  switch (event.type) {
    case 'checkout.session.completed': {
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
      break;
    }

    case 'customer.subscription.deleted':
    case 'invoice.payment_failed': {
      const subscription = event.data.object as Stripe.Subscription;

      await supabase
        .from('profiles')
        .update({ stripe_subscription_active: false })
        .eq('stripe_subscription_id', subscription.id);
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
