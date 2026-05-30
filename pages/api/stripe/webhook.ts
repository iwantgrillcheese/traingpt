import type { NextApiRequest, NextApiResponse } from 'next/types';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { buffer } from 'micro';
import { getStripeClient } from '@/utils/stripe';

export const config = {
  api: {
    bodyParser: false,
  },
};

function getServiceSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

function subscriptionIsActive(subscription: Stripe.Subscription) {
  return subscription.status === 'active' || subscription.status === 'trialing';
}

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

  const supabase = getServiceSupabase();

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = typeof session.customer === 'string' ? session.customer : null;
      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null;
      const userId = typeof session.metadata?.userId === 'string' ? session.metadata.userId : null;

      if (customerId && subscriptionId) {
        const updatePayload = {
          stripe_customer_id: customerId,
          stripe_subscription_active: true,
          stripe_subscription_id: subscriptionId,
        };

        const query = supabase.from('profiles').update(updatePayload);

        if (userId) {
          await query.eq('id', userId);
        } else {
          await query.eq('stripe_customer_id', customerId);
        }
      }
    }

    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === 'string' ? subscription.customer : null;
      const userId = typeof subscription.metadata?.userId === 'string' ? subscription.metadata.userId : null;

      if (customerId || userId) {
        const updatePayload = {
          ...(customerId ? { stripe_customer_id: customerId } : {}),
          stripe_subscription_active: subscriptionIsActive(subscription),
          stripe_subscription_id: subscription.id,
        };

        const query = supabase.from('profiles').update(updatePayload);

        if (userId) {
          await query.eq('id', userId);
        } else if (customerId) {
          await query.eq('stripe_customer_id', customerId);
        }
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;

      await supabase
        .from('profiles')
        .update({ stripe_subscription_active: false })
        .eq('stripe_subscription_id', subscription.id);
    }

    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : null;
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : null;

      if (subscriptionId) {
        await supabase
          .from('profiles')
          .update({ stripe_subscription_active: false })
          .eq('stripe_subscription_id', subscriptionId);
      } else if (customerId) {
        await supabase
          .from('profiles')
          .update({ stripe_subscription_active: false })
          .eq('stripe_customer_id', customerId);
      }
    }
  } catch (err) {
    console.error('[Stripe Webhook] Supabase update failed', err);
    return res.status(500).json({ received: false });
  }

  return res.json({ received: true });
}
