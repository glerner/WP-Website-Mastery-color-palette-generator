# Productization Plan: Landing, Auth, Payments, Quotas (Vercel)

This document outlines what is required to add a true landing page, allow one free export, accept payments (Stripe/PayPal) while hosting on Vercel, add login, and track exports to enforce limits. This is a plan only; no code changes implied here.

## Architecture Overview

- Hosting: Vercel (static frontend + serverless functions under `api/`).
- Frontend: existing Vite + React app.
- Routing: `react-router-dom` for `/` (Landing) and `/app` (Generator UI), plus `/login`, `/account`.
- Auth: Managed provider (Clerk, Auth0, or Supabase Auth).
- Database: Vercel Postgres or Supabase/Neon to persist users, plans, export usage.
- Payments: Stripe first (subscriptions and/or one-time). Optionally add PayPal for one-time later.
- Serverless: Vercel Functions for export, entitlements, Stripe webhooks.

## Routes and Pages

- `/` Landing/Sales: SEO content, pricing, CTA to sign in and try a free export.
- `/app` Generator: main UI. Gated when user exceeds free limit.
- `/login`: auth screen (provider-hosted or embedded component).
- `/account`: plan details, usage, billing portal link.

## Authentication

- Choice: Clerk (simple Vite integration), Auth0 (enterprise), or Supabase Auth (pairs with DB).
- Client: provider SDK to manage sessions and supply ID token.
- Server: middleware/utility to verify session on each protected API (exports, account).

## Payments (Stripe recommended)

- Products/Prices: define in Stripe Dashboard (e.g., Pro subscription, Export Pack one-time).
- Checkout: client requests `POST /api/stripe/create-checkout-session` → redirect to Stripe Checkout.
- Billing Portal: `POST /api/stripe/portal-link` for users to manage subscriptions.
- Webhooks: `POST /api/stripe/webhook` handle `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated|deleted` to provision entitlements.

## Export Entitlements and Usage Limits

Policy examples:

- Anonymous: 0 exports or require account to claim 1 free export.
- Free account: exactly 1 export (lifetime) unless they purchase more or subscribe.
- Pro subscriber: unlimited or high monthly quota; resets monthly.
- One-time pack: adds N export credits; decrement per export.

Enforcement:

- All exports go through `POST /api/export`.
- The endpoint verifies session, checks quota/credits in DB, atomically decrements on success, then returns the ZIP (or signed URL).
- Never perform export purely client-side for quota enforcement.

## Minimal Database Schema (suggested)

- `users`: `id` (auth id), `email`, timestamps.
- `plans`: `user_id`, `plan` (free|pro|one_time), `status`, `stripe_customer_id`, `stripe_subscription_id`, timestamps.
- `entitlements`: `user_id`, `export_quota` (nullable for unlimited), `export_credits` (int), `resets_at` (timestamp for subscription periods).
- `usage`: `user_id`, `export_count`, `period_start`, `period_end`.
- `transactions`: `user_id`, `provider` (stripe|paypal), `type` (subscription|one_time), `status`, `amount`, `currency`, `event_id` (webhook), timestamps.
- Optional: `audit_logs` for export actions and webhook processing.

## Serverless Endpoints (Vercel)

- Auth middleware: verify tokens for `/api/*`.
- Payments:
  - `POST /api/stripe/create-checkout-session`
  - `POST /api/stripe/portal-link`
  - `POST /api/stripe/webhook` (verify signatures)
- Exports:
  - `POST /api/export` (quota check → generate ZIP → decrement usage)
- Account:
  - `GET /api/me/entitlements` (plan and usage for UI gating)

## Environment Variables (Vercel)

- Auth provider keys: `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` (or Auth0/Supabase equivalents).
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_PACK`.
- Database: `DATABASE_URL` (Vercel Postgres/Supabase).
- App URLs: `APP_BASE_URL`, `STRIPE_SUCCESS_URL`, `STRIPE_CANCEL_URL`.

## Security and Compliance

- PCI: delegate card entry to Stripe Checkout; do not handle card details.
- Webhooks: verify signatures and use idempotency to avoid double-provisioning.
- Rate limit sensitive endpoints and log key actions.
- Add Terms, Privacy, and cookie notices as needed.

## Analytics and Email

- Analytics: Vercel Analytics or Plausible for funnels and conversion.
- Email: auth verification emails; rely on Stripe for receipts; optional transactional emails for "export ready" or quota alerts.

## Suggested Milestones

1. Landing page and routing (`/`, `/app`, `/login`, `/account`).
2. Auth integration and session verification on API.
3. Database setup for users, plans, entitlements, usage, transactions.
4. Stripe Checkout + Customer Portal + webhooks provisioning.
5. Export API with atomic quota checks and file delivery.
6. UI gating of Export based on `GET /api/me/entitlements`.

## Email/CRM (Brevo)

- Purpose: add buyers/subscribers to a Brevo list and keep attributes in sync.
- Trigger: Stripe webhooks (e.g., `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated|deleted`).
- Action: Upsert contact into Brevo using REST v3 with `updateEnabled: true`.
- Endpoint: `POST https://api.brevo.com/v3/contacts`
- Headers: `api-key: BREVO_API_KEY`, `Content-Type: application/json`
- Body shape (example):
  - `{ "email": "customer@example.com", "listIds": [BREVO_LIST_ID], "attributes": { "PLAN": "pro", "SOURCE": "stripe", "SUB_ACTIVE": true, "CREDITS": 10 }, "updateEnabled": true }`
- Environment variables:
  - `BREVO_API_KEY`
  - `BREVO_LIST_ID` (or per-plan list IDs if you prefer multiple lists)
- Compliance:
  - For marketing emails, obtain consent (checkbox in app before redirect, or separate opt-in). Transactional notices are okay but keep lists/attributes clear.

## Time/Effort Estimate (MVP)

- Payments (Stripe Checkout + Portal + webhooks provisioning): 6–10 hours
- Auth (Clerk or Supabase) + session verification + route gating: 4–8 hours
- Database (Vercel Postgres/Supabase) + minimal schema + wiring: 4–8 hours
- Export entitlements (`POST /api/export` with atomic decrement + ZIP delivery): 4–6 hours
- Frontend changes (Buy/Subscribe buttons, Account page, UI gating): 4–6 hours
- Brevo integration (webhook-driven upsert): 1–3 hours
- Testing end‑to‑end (Stripe CLI, edge cases): 4–6 hours
- Total: ~3–5 focused days for a solid MVP

## Decisions Needed

- Auth provider: Clerk (fastest Vite integration) vs Supabase Auth (DB+auth) vs Auth0.
- Database: Vercel Postgres vs Supabase/Neon.
- Monetization: subscription, export credit packs, or both.
- Quotas: free trial rule (e.g., 1 free export/account), subscriber quota (unlimited or X/month), pack sizes.
- Brevo strategy: single list + attributes/tags (recommended) vs multiple lists; define attributes (e.g., `PLAN`, `SUB_ACTIVE`, `CREDITS`, `SOURCE`).

## Proposed Defaults (based on current preferences)

- Payments: Stripe (set up on your new LLC account).
- Auth: Clerk (fastest to integrate with Vite; great hosted UI components).
- Database: Vercel Postgres (simple, first‑party on Vercel; store users/entitlements/transactions).
- Trial policy: 3 free exports per account (requires login to claim/use).
- Brevo: single list with attributes/tags (`PLAN`, `SUB_ACTIVE`, `CREDITS`, `SOURCE`).

These defaults can be switched later (e.g., migrate to Supabase or add PayPal for one‑time packs) with minimal code churn if we isolate integrations.

## Auth choice: Clerk vs Supabase Auth (quick guide)

- Clerk
  - Pros: very fast setup in Vite/React; hosted login components (email magic link, password, OAuth); session management; good docs.
  - Cons: external vendor for auth; you map `user.id` to your DB; pricing after free tier.
- Supabase Auth
  - Pros: auth and Postgres in one platform; open source; Row Level Security; flexible self‑hosting path.
  - Cons: slightly more manual UI wiring in Vite; you configure policies/email sending; tighter coupling to Supabase stack.

Recommendation for MVP speed: Clerk + Vercel Postgres. If you prefer one consolidated platform, choose Supabase (Auth + DB) and deploy to Vercel.

## Pricing and packaging guidance (initial hypotheses)

- Audience: freelancers/SMB agencies building client sites.
  - Subscription: $19–$29/mo for "Pro" (unlimited reasonable use or high monthly quota, e.g., 200 exports/mo).
  - Export pack: $19 for 20 exports (no subscription). Good for occasional users.
- Team/Business: $49–$99/mo includes higher quotas and priority support.
- Corporate: defer enterprise features (SSO, SLAs) until demand; price $199+/mo later if needed.
- Rationale: agencies create palettes per project and iterate; credits/subscriptions align with usage. A static catalog (e.g., 1440 prebuilt palettes) is less compelling than tailored, AAA‑checked exports for their brand.

Stripe SKUs to create for MVP:
- `price_pro_monthly` (recurring monthly)
- `price_export_pack_20` (one‑time)

## What Vercel Provides vs What You Build

- Vercel provides: static hosting, serverless functions, environment variables, analytics.
- You build: Stripe integration (Checkout, Portal), webhook handlers, auth integration, database schema/queries, export entitlement logic, Brevo upsert.

## Security and Data Flow (for future projects)

- Why POST `/api/export`?
  - Exporting a ZIP and decrementing credits is a state‑changing, authenticated action. A server‑side POST endpoint is the standard pattern to apply auth, enforce quotas atomically in the DB, and return the file/signed URL. Keeping this logic server‑side prevents circumvention and centralizes auditing.

- Transport security
  - Use HTTPS/TLS everywhere (Vercel default). Both GET and POST are encrypted under HTTPS; POST is used for non‑idempotent operations and to keep sensitive details out of URLs.
  - Never put secrets in query strings. Use headers or secure cookies for sessions and server‑to‑server auth.

- Auth vs OAuth
  - Your SPA calls your own API using the app’s auth session (e.g., Clerk). You do not need OAuth between your SPA and your API.
  - Use OAuth only when delegating access to third‑party resources on behalf of users. For Stripe/Brevo here, you use your server‑side API keys and webhooks, not user‑delegated OAuth.

- PCI and card handling
  - Card entry occurs only on Stripe‑hosted pages (Checkout and Customer Billing Portal). Your servers never see raw card data; this keeps you in lowest PCI scope.
  - Always verify Stripe webhook signatures and use idempotency to avoid double‑processing.

- Additional best practices
  - Rate‑limit sensitive endpoints.
  - Minimize PII in storage (email + plan/credits are typically sufficient).
  - Log key actions (webhook processed, export performed) for auditability.

### "Can I just add a PayPal button?"

- A standalone PayPal button can collect money, but it does not provision access, enforce export quotas, or manage subscriptions by itself.
- You would still need to process payment notifications (IPN/webhooks), map payments to users, update credits/subscriptions, and gate `/api/export`.
- Stripe Checkout + webhooks is the most straightforward path for quotas/subscriptions. PayPal can be added later for one‑time purchases.

### About AI agents

- Agents can scaffold code (routes, SDK setup, helpers) and reduce boilerplate, but you still need to supply API keys, choose products/prices, and run Stripe CLI tests.
- Expect real integration work: wiring webhooks, DB updates, and entitlement checks. It’s standard, not custom, but not a one‑click “add button”.

7. Analytics, docs, and polish.

## Setup Steps

1. Stripe (payments)
   - Create your LLC Stripe account (or switch from personal to LLC).
   - Create Products/Prices:
     - Pro Monthly subscription → note the price ID, set env `PRICE_PRO_MONTHLY`.
     - Export Pack 20 (one‑time) → note the price ID, set env `PRICE_EXPORT_PACK_20`.
   - Get `STRIPE_SECRET_KEY` from Developers → API keys.
   - Set URLs:
     - `APP_BASE_URL` (e.g., https://your-app.vercel.app)
     - `STRIPE_SUCCESS_URL` (e.g., https://your-app.vercel.app/success)
     - `STRIPE_CANCEL_URL` (e.g., https://your-app.vercel.app/account)

2. Vercel Postgres (database)
   - Provision a Vercel Postgres database; copy `DATABASE_URL`.
   - Run `docs/db-schema.sql` in the SQL console to create tables and helper functions.

3. Brevo (email/CRM)
   - Create an API key; create a list (e.g., "Customers").
   - Set envs: `BREVO_API_KEY`, `BREVO_LIST_ID`.

4. Clerk (authentication)
   - Create a Clerk application; copy keys.
   - Set envs: `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`.
   - Note: during early testing, a dev header `X-Dev-User-Id` can be used; replace with real Clerk verification before production.

5. Add all environment variables in Vercel (Project → Settings → Environment Variables)
   - Clerk: `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
   - Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PRICE_PRO_MONTHLY`, `PRICE_EXPORT_PACK_20`
   - Database: `DATABASE_URL`
   - Brevo: `BREVO_API_KEY`, `BREVO_LIST_ID`
   - App URLs: `APP_BASE_URL`, `STRIPE_SUCCESS_URL`, `STRIPE_CANCEL_URL`

6. Stripe Webhook
   - In Stripe Dashboard → Developers → Webhooks, add endpoint: `https://<your-app>/api/stripe/webhook`.
   - Subscribe to events:
     - `checkout.session.completed`
     - `invoice.paid`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
   - Copy Signing Secret and set `STRIPE_WEBHOOK_SECRET` in Vercel envs.

7. Local/early testing
   - Create a Checkout session (with dev header) to test flow before Clerk is wired:
     - `POST /api/stripe/create-checkout-session` with header `X-Dev-User-Id: dev_user_123` and body `{ "mode": "subscription" }`.
   - Complete payment in Stripe test mode; verify webhook call and DB updates.

8. Production hardening
   - Replace dev header with real Clerk verification in `helpers/server/auth.ts`.
   - Verify webhook signature and idempotency (event_id) in `/api/stripe/webhook`.
   - Gate `/api/export` on credits/subscription; log `audit_logs`.

