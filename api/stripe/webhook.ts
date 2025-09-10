// Scaffold: Stripe Webhook handler
// Verifies Stripe signature and processes subscription/payment events.
// Env: STRIPE_WEBHOOK_SECRET, STRIPE_SECRET_KEY

export const config = { api: { bodyParser: false } } as any; // ensure raw body for signature verification if needed by hosting

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  try {
    // TODO: read raw body, verify Stripe signature
    // TODO: switch on event types, update entitlements, upsert to Brevo
    // TODO: use idempotency to avoid double-processing (store event id)
    res.status(501).json({ ok: false, message: 'Not implemented yet' });
  } catch (err: any) {
    console.error('webhook error', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
