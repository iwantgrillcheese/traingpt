import type { NextApiRequest, NextApiResponse } from 'next/types';
import { getStripeClient } from '@/utils/stripe';
import Stripe from 'stripe';
import { buffer } from 'micro';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).end('Method Not Allowed');
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;

  try {
    const stripe = getStripeClient();

    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('[Webhook Error]', err);
    return res.status(400).send(`Webhook Error: ${(err as Error).message}`);
  }

  const supabase = createServerSupabaseClient({ req, res });

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

  return res.json({ received: true });
}
