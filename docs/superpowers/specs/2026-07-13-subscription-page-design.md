# Subscription page (FormCraft)

**Goal:** Logged-in members manage FormCraft Pro via Wix Pricing Plans.

## Scope
- Page: `/dashboard/subscription` (member-gated)
- Status: Free vs Pro from active/pending Pro orders
- Upgrade: existing `/api/upgrade` checkout
- Cancel: `requestCancellation` with `NEXT_PAYMENT_DATE` (end of period)
- Invoices: billing history rows from member orders (amount, cycle, payment status) — not PDF receipts

## APIs
- Read: `@wix/pricing-plans` `orders.memberListOrders` (member token, no elevate)
- Fallback: elevated admin list filtered by buyer (existing `plan.ts` pattern)
- Cancel: `POST /pricing-plans/v2/member/orders/{id}/cancel` with `effectiveAt: NEXT_PAYMENT_DATE`

## Out of scope
- Immediate cancel, pause/resume, PDF invoice download
