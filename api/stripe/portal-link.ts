// Stripe Customer Billing Portal link
// Env: STRIPE_SECRET_KEY, APP_BASE_URL

import Stripe from 'stripe';
import { requireAuth } from '../../helpers/server/auth';
import { sql } from '@vercel/postgres';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  try {
    const { userId } = await requireAuth(req);

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      res.status(500).json({ error: 'Missing STRIPE_SECRET_KEY' });
      return;
    }
    const appBase = process.env.APP_BASE_URL || '';
    if (!appBase) {
      res.status(500).json({ error: 'Missing APP_BASE_URL' });
      return;
    }
    const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });

    // Lookup existing stripe_customer_id
    const { rows } = await sql/*sql*/`SELECT stripe_customer_id, email FROM users WHERE user_id = ${userId} LIMIT 1;`;
    let customerId: string | null = (rows?.[0]?.stripe_customer_id as string) || null;
    const email: string | undefined = rows?.[0]?.email || undefined;

    if (!customerId) {
      // Create a Stripe customer and store it
      const customer = await stripe.customers.create({
        ...(email ? { email } : {}),
        metadata: { clerk_user_id: userId },
      } as any);
      customerId = customer.id;
      await sql/*sql*/`INSERT INTO users (user_id, email, stripe_customer_id)
        VALUES (${userId}, ${email || null}, ${customerId})
        ON CONFLICT (user_id) DO UPDATE SET stripe_customer_id = EXCLUDED.stripe_customer_id;`;
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId!,
      return_url: appBase + '/account',
    });
    res.status(200).json({ url: portal.url });
  } catch (err: any) {
    if (err?.statusCode === 401) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    console.error('portal-link error', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
