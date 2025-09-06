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
7. Analytics, docs, and polish.
