// helpers/server/brevo.ts
// Brevo upsert contact scaffold using REST v3
// Env: BREVO_API_KEY, BREVO_LIST_ID

export type BrevoAttributes = {
  PLAN?: 'free' | 'pro' | 'pack';
  SUB_ACTIVE?: boolean;
  CREDITS?: number;
  SOURCE?: 'stripe' | string;
  LAST_PURCHASE_AT?: string; // ISO
};

export async function upsertBrevoContact(params: {
  email: string;
  listId?: number | string;
  attributes?: BrevoAttributes;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) return { ok: false, error: 'Missing BREVO_API_KEY' };
    const listIdEnv = process.env.BREVO_LIST_ID;
    const listIds: number[] = [];
    const idToUse = params.listId ?? listIdEnv;
    if (idToUse != null && `${idToUse}`.trim() !== '') {
      const n = Number(idToUse);
      if (!Number.isNaN(n)) listIds.push(n);
    }

    const res = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        email: params.email,
        listIds: listIds.length ? listIds : undefined,
        attributes: params.attributes ?? undefined,
        updateEnabled: true,
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return { ok: false, error: `Brevo error ${res.status}: ${txt}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Brevo request failed' };
  }
}
