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

- `Forms`: `ownerId, title, description, slug, templateId, fields(JSON), theme(JSON), published, submissionCount`
- `Submissions`: `formId, ownerId, data(JSON), exported`
- Permissions: `Submissions.insert = ANYONE` (public submit); everything else ADMIN,
  reached server-side via elevation and owner-scoped in code.

## Scripts

- `scripts/create-collections.mjs` — provisions the two CMS collections (idempotent).
  Uses `npx wix token --site <id>` + REST.

## Develop / deploy

```bash
npm run build     # wix build (astro build + wix runtime packaging)
npm run release   # wix release  → publishes to the wix-site-host URL
```

> The real production URL is the prefixed host in `.wix/topology.json`
> (`fpvjxz-form-craft-...`); the un-prefixed alias also serves.

## Known polish items

- The public thank-you message is English text rendered under the form's `dir`; on an
  RTL form the `!`/`.` punctuation visually flips. Cosmetic only.
- Freemium Pro tier is gated in code (`src/lib/plan.ts`) but resolves everyone to
  `free` until a Wix Pricing Plan product is configured; wire the plan lookup there.
