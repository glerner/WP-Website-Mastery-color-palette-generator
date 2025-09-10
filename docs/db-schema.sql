-- Vercel Postgres: Minimal schema for auth + entitlements + transactions + audit logs
-- Run these statements in your Vercel Postgres SQL console.
-- Idempotent where possible.

BEGIN;

-- Users table: maps Clerk users to Stripe customer and email
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,                 -- Clerk user ID
  email TEXT,
  stripe_customer_id TEXT UNIQUE,           -- Set after first successful Checkout
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- Entitlements: plan/credits/quota-state per user
CREATE TABLE IF NOT EXISTS entitlements (
  user_id TEXT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free',        -- 'free' | 'pro' | 'pack'
  export_credits INTEGER,                   -- NULL => unlimited for the period; non-null => remaining credits
  sub_active BOOLEAN NOT NULL DEFAULT FALSE,
  resets_at TIMESTAMPTZ,                    -- for monthly subscription resets
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transactions: record Stripe events for idempotency + reporting
CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'stripe',  -- fixed 'stripe' for now
  type TEXT NOT NULL,                       -- 'subscription' | 'one_time'
  status TEXT NOT NULL,                     -- 'paid' | 'active' | 'canceled' | etc.
  amount INTEGER,                           -- in smallest currency unit (cents)
  currency TEXT,
  event_id TEXT UNIQUE,                     -- Stripe event id for idempotency
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON transactions (user_id, created_at DESC);

-- Optional audit log for debug/support
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
  action TEXT NOT NULL,                     -- 'export', 'webhook_processed', etc.
  meta JSONB,                               -- arbitrary details
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Helper function to ensure a user row exists
-- Call before setting entitlements or transactions
-- Example: SELECT ensure_user($1, $2);
CREATE OR REPLACE FUNCTION ensure_user(p_user_id TEXT, p_email TEXT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO users(user_id, email)
  VALUES (p_user_id, p_email)
  ON CONFLICT (user_id) DO UPDATE SET email = COALESCE(EXCLUDED.email, users.email);

  INSERT INTO entitlements(user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Atomic decrement of one export credit, returns TRUE if decremented
-- Use when packs/credits are in effect (export_credits not null)
CREATE OR REPLACE FUNCTION try_decrement_credit(p_user_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_credits INTEGER;
BEGIN
  -- Lock the row to prevent race conditions
  SELECT export_credits INTO v_credits
  FROM entitlements
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_credits IS NULL THEN
    -- unlimited for this plan period
    UPDATE entitlements SET updated_at = NOW() WHERE user_id = p_user_id;
    RETURN TRUE;
  ELSIF v_credits > 0 THEN
    UPDATE entitlements
      SET export_credits = v_credits - 1,
          updated_at = NOW()
      WHERE user_id = p_user_id;
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql;

COMMIT;
