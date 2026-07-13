# FormCraft

A multi-tenant SaaS where anyone can build custom registration/intake forms with a
drag-and-drop builder, publish them as public links, and manage submissions in a
built-in admin panel (search, CSV export, duplicate detection, bulk delete).

Built on **Wix Headless + Astro SSR + React islands + Tailwind v4**. Spun out of the
Pichman parking-gate form pattern into a general-purpose product.

## Live

- **Site:** https://form-craft-a0c55fcc-shaykovach.wix-site-host.com
- **Wix headless project:** siteId `6b080820-d034-497b-9643-dafcdb9e15d5`, appId `71da1580-571e-4434-b5d0-d370358e7079`

## How it works

| Area | Route | Notes |
|------|-------|-------|
| Marketing home | `/` | Zero-JS SSR, full SEO (JSON-LD, OG, Wix sitemap/robots) |
| Pricing | `/pricing` | Free vs Pro (freemium) |
| Dashboard | `/dashboard` | Auth-gated; lists a creator's forms + quota |
| New form | `/dashboard/forms/new` | 5 templates |
| Builder | `/dashboard/forms/[id]/edit` | dnd-kit drag-drop, settings, live preview, autosave, publish |
| Responses | `/dashboard/forms/[id]/submissions` | Admin panel (dynamic columns) |
| Public form | `/f/[slug]` | Dynamic renderer from the field schema |
| APIs | `/api/forms`, `/api/forms/[id]`, `/api/submit`, `/api/submissions/{export,delete}` | |

## Architecture decisions

- **Admin data access uses elevation, not an API key.** Because this is a *Wix-managed*
  headless project, `auth.elevate(items.*)` from `@wix/essentials` grants admin-level
  CMS access in backend routes with **no external API key**. (The earlier Pichman
  `__type` crash was an artifact of a mis-provisioned "Site" project — on a proper
  headless project, elevation works. See `src/lib/wix-admin.ts`.)
- **Provisioning matters:** the site MUST be created with `npm create @wix/new@latest headless`
  (a headless project), NOT `... init` (which makes a standard "Site" whose runtime
  can't host the Astro worker → "Runtime is unreachable" 504s).
- **Hybrid data model:** `Forms` (schema as JSON) + `Submissions` (`formId` + `data` JSON).
  One central pair of collections, not a collection per form.
- **`items.update` is a full-document REPLACE.** All updates use read-modify-write
  (`updateForm`) or rebuild the full record (`markExported`) to avoid wiping fields.
- **No `nanoid`** — its cjs entry does a top-level `require('crypto')` that crashes the
  Cloudflare Worker runtime Wix uses. Slugs use an inline `Math.random` generator.
- Landing page ships **zero client JS**; interactive surfaces are React islands only.

## Data model

- `Forms`: `ownerId, title, description, slug, templateId, fields(JSON), theme(JSON), published, submissionCount, viewCount, startCount`
- `Submissions`: `formId, ownerId, data(JSON), exported`
- Permissions: `Submissions.insert = ANYONE` (public submit); everything else ADMIN,
  reached server-side via elevation and owner-scoped in code.

## Scripts

- `scripts/create-collections.mjs` — provisions the two CMS collections (idempotent).
  Uses `npx wix token --site <id>` + REST.
- `scripts/add-analytics-fields.mjs` — adds `viewCount` / `startCount` to an existing Forms collection.

## Develop / deploy

```bash
npm run build     # wix build (astro build + wix runtime packaging)
npm run release   # wix release  → publishes to the wix-site-host URL
```

> The real production URL is the prefixed host in `.wix/topology.json`
> (`fpvjxz-form-craft-...`); the un-prefixed alias also serves.

## Subscriptions (freemium → Pro)

- **Product:** a Wix **Pricing Plans** recurring plan — "FormCraft Pro", €12/mo,
  plan id `eb231ba3-8ceb-4981-bc85-61b2d1f50fbb` (`PRO_PLAN_ID` in `src/lib/plan.ts`).
- **Detection:** `getPlanTier(memberId)` reads the member's active Pro orders via the
  Pricing Plans REST API using an **elevated** `httpClient.fetchWithAuth`
  (`GET /pricing-plans/v2/orders?planIds=<PRO>&orderStatuses=ACTIVE`). Works from any
  context (owner dashboard *and* public visitor submit), degrades to `free` on error.
- **Upgrade:** `POST /api/upgrade` creates a headless **paid-plans checkout redirect
  session** (`@wix/redirects`, `paidPlansCheckout: { planId }`) in the **member's**
  context (not elevated — so `maintainIdentity` carries their login into Wix checkout)
  and returns `redirectSession.fullUrl`. `UpgradeButton.tsx` drives it from the pricing
  page and the dashboard limit banner; 401 routes through login first. Post-checkout
  returns to `/dashboard?upgraded=1`.
- **Manage:** `/dashboard/subscription` shows Free/Pro status, billing history from
  Pricing Plan orders, Upgrade (Free), and **Cancel at period end** via member
  `requestCancellation` (`NEXT_PAYMENT_DATE`).
- **Enforcement:** free = 1 published form + 100 responses/mo; Pro = unlimited. Checked
  on publish (`PATCH /api/forms/[id]`) and submit (`/api/submit`).

> **One owner step to take real payments:** connect a payment provider that supports
> recurring charges in the Wix dashboard
> (`support.wix.com/en/article/accepting-recurring-payments`). The full flow up to the
> payment step is live without it.

## Known polish items

- The public thank-you message is English text rendered under the form's `dir`; on an
  RTL form the `!`/`.` punctuation visually flips. Cosmetic only.
