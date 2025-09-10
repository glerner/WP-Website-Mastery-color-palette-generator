// helpers/server/db.ts
// Vercel Postgres client scaffold and minimal queries for users/entitlements/transactions
// Replace stubs with real schema and queries.

import { sql } from '@vercel/postgres';

export type Entitlements = {
  user_id: string;
  plan: 'free' | 'pro' | 'pack';
  export_credits: number | null; // null means unlimited per plan period
  resets_at: string | null; // ISO timestamp
  sub_active: boolean;
};

export async function getEntitlements(userId: string): Promise<Entitlements | null> {
  try {
    // TODO: replace with your actual schema
    const { rows } = await sql/*sql*/`
      SELECT user_id, plan, export_credits, resets_at, sub_active
      FROM entitlements
      WHERE user_id = ${userId}
      LIMIT 1;
    `;
    return (rows?.[0] as any) ?? null;
  } catch (e) {
    console.warn('getEntitlements fallback (no table yet):', e);
    return {
      user_id: userId,
      plan: 'free',
      export_credits: 3, // trial default
      resets_at: null,
      sub_active: false,
    };
  }
}

export async function decrementCredit(userId: string): Promise<boolean> {
  // TODO: perform atomic decrement in a transaction with SELECT ... FOR UPDATE
  // For now, pretend success
  return true;
}

export async function recordTransaction(params: {
  userId: string;
  provider: 'stripe';
  type: 'subscription' | 'one_time';
  status: string;
  amount?: number;
  currency?: string;
  eventId?: string;
}): Promise<void> {
  // TODO: insert into transactions table with idempotency on eventId
}
