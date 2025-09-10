// Stripe Checkout Session creator
// Runs on Vercel as /api/stripe/create-checkout-session
// Env: STRIPE_SECRET_KEY, PRICE_PRO_MONTHLY, PRICE_EXPORT_PACK_20, APP_BASE_URL, STRIPE_SUCCESS_URL, STRIPE_CANCEL_URL

import Stripe from 'stripe';
import { requireAuth } from '../../helpers/server/auth';

type Body = {
  mode: 'subscription' | 'payment';
  priceId?: string; // optional, will use env defaults when omitted
  // optional: quantity for packs
  quantity?: number;
};

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
    const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });

    const body: Body = (() => {
      try { return JSON.parse(req.body || '{}'); } catch { return {} as any; }
    })();
    if (body?.mode !== 'subscription' && body?.mode !== 'payment') {
      res.status(400).json({ error: 'Invalid mode' });
      return;
    }

    // Resolve price
    const defaultSub = process.env.PRICE_PRO_MONTHLY;
    const defaultPack = process.env.PRICE_EXPORT_PACK_20;
    const priceId = body.priceId || (body.mode === 'subscription' ? defaultSub : defaultPack);
    if (!priceId) {
      res.status(400).json({ error: 'Missing priceId (and no default set in env)' });
      return;
    }

    const successUrl = process.env.STRIPE_SUCCESS_URL || `${process.env.APP_BASE_URL || ''}/success`;
    const cancelUrl = process.env.STRIPE_CANCEL_URL || `${process.env.APP_BASE_URL || ''}/account`;
    if (!successUrl || !cancelUrl) {
      res.status(500).json({ error: 'Missing STRIPE_SUCCESS_URL/STRIPE_CANCEL_URL or APP_BASE_URL' });
      return;
    }

    const quantity = body.mode === 'payment' && Number.isFinite(body.quantity) && (body.quantity as number) > 0
      ? Math.floor(body.quantity as number)
      : 1;

    const session = await stripe.checkout.sessions.create({
      mode: body.mode,
      line_items: [{ price: priceId, quantity }],
      success_url: successUrl + '?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: cancelUrl,
      // Best-effort to associate a customer by Clerk user ID in metadata
      metadata: { clerk_user_id: userId },
      allow_promotion_codes: true,
    });

    res.status(200).json({ url: session.url });
  } catch (err: any) {
    if (err?.statusCode === 401) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    console.error('create-checkout-session error', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
