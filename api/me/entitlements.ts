// Entitlements endpoint
// Returns current user's plan/credits for UI gating

import { requireAuth } from '../../helpers/server/auth';
import { getEntitlements } from '../../helpers/server/db';

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  try {
    const { userId } = await requireAuth(req);
    const ent = await getEntitlements(userId);
    res.status(200).json({
      plan: ent?.plan ?? 'free',
      credits: ent?.export_credits ?? 0,
      subActive: !!ent?.sub_active,
      resetsAt: ent?.resets_at ?? null,
    });
  } catch (err: any) {
    if (err?.statusCode === 401) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    console.error('entitlements error', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
