// Scaffold: Export endpoint
// Auth required via Clerk; verifies entitlements in DB, decrements credits atomically, returns ZIP/signed URL.
// For now, returns 501 Not Implemented.

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  try {
    // TODO: verify Clerk session
    // TODO: check DB entitlements and decrement
    // TODO: build ZIP or signed URL and return
    res.status(501).json({ ok: false, message: 'Not implemented yet' });
  } catch (err: any) {
    console.error('export error', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
