# FormCraft — Design Spec

**Date:** 2026-07-11
**Status:** Approved (design sections 1–5 approved by user; DnD builder pulled forward per "top-10 drag-drop" directive)

## Summary

FormCraft is a multi-tenant SaaS platform where any Wix member can build custom
registration / intake forms with a drag-and-drop builder, publish them as public
links, collect submissions, and manage those submissions in a built-in admin panel
(search, CSV export, duplicate detection, delete). Built on Wix Headless + Astro SSR
+ React islands + Tailwind v4. It is a new, standalone Wix site, separate from the
Pichman parking form that seeded the pattern.

**Site:** siteId `dac5856c-739c-4961-8b0c-09dedbbe6656`, appId `df4c59be-68e3-4cb0-86fd-ef088ee1f4b6`.

## Goals

- A **stunning, conversion-focused marketing homepage** that sells the product, with
  full SEO (meta, OpenGraph, JSON-LD, sitemap, robots) and top PageSpeed (SSR HTML,
  minimal JS, islands only where interactive).
- A **best-in-class drag-and-drop form builder** (dnd-kit) with a live preview,
  field palette, per-field settings, and template library.
- **Public published forms** at `/f/[slug]` rendered dynamically from a field schema.
- **Per-form admin panel** reusing the proven Pichman pattern (search, filter, CSV,
  duplicate detection, bulk delete), with dynamic columns.
- **Freemium** gating via Wix Pricing Plans (free: 1 form + 100 submissions/mo;
  Pro: unlimited, monthly).

## Non-Goals (v1)

- Conditional logic / branching (field schema is designed to allow it later).
- Multi-page/step forms (schema supports a `step` field for later).
- File-upload fields at storage layer (rendered as disabled "coming soon" in v1).
- Payment collection inside forms.
- Team/collaborator sharing of a single form.

## Architecture

New standalone Wix Headless site. Astro SSR (`output: "server"`, `@wix/astro`
integration). React islands only for interactive surfaces (builder, form renderer,
admin panel). Everything else is server-rendered static HTML for SEO + PageSpeed.

```
formcraft/
├── src/
│   ├── pages/
│   │   ├── index.astro                    ← marketing homepage (SSR, no JS island)
│   │   ├── pricing.astro                  ← pricing page
│   │   ├── dashboard/
│   │   │   ├── index.astro                ← "My Forms" (auth-gated)
│   │   │   └── forms/
│   │   │       ├── new.astro              ← template picker
│   │   │       ├── [id]/edit.astro        ← DnD builder host
│   │   │       └── [id]/submissions.astro ← admin panel host
│   │   ├── f/[slug].astro                 ← public published form
│   │   ├── sitemap.xml.ts                 ← dynamic sitemap
│   │   ├── robots.txt.ts                  ← robots
│   │   └── api/
│   │       ├── auth/login.ts              ← HTTPS-forcing OAuth login (ported)
│   │       ├── forms/index.ts             ← POST create form
│   │       ├── forms/[id].ts              ← PATCH update / DELETE form
│   │       ├── submit.ts                  ← POST public submission
│   │       ├── submissions/export.ts      ← POST CSV export + mark exported
│   │       └── submissions/delete.ts      ← POST bulk delete
│   ├── components/
│   │   ├── Layout.astro                   ← base HTML + SEO head
│   │   ├── Seo.astro                      ← meta/OG/JSON-LD component
│   │   ├── landing/*.astro                ← Hero, Features, Showcase, Steps, Pricing, FAQ, CTA, Footer, Nav
│   │   ├── builder/FormBuilder.tsx        ← dnd-kit builder island
│   │   ├── builder/*.tsx                  ← Palette, Canvas, FieldCard, SettingsPanel, PreviewPane
│   │   ├── FormRenderer.tsx               ← public form island
│   │   └── SubmissionsPanel.tsx           ← admin island (ported from Pichman)
│   └── lib/
│       ├── wix-admin.ts                   ← ApiKeyStrategy admin client (ported)
│       ├── forms.ts                       ← Forms CRUD + slug + ownership
│       ├── submissions.ts                 ← Submissions query/insert/export/delete
│       ├── form-schema.ts                 ← FieldConfig types + field-type registry
│       ├── templates.ts                   ← 5 pre-built templates
│       ├── plan.ts                        ← freemium limits + quota checks
│       └── csv.ts                         ← shared CSV builder
```

## Data Model

Three Wix CMS collections (hybrid model — chosen over collection-per-form to avoid
the ~1000-collection cap and enable cross-form queries):

**`Forms`**
| field | type | notes |
|-------|------|-------|
| `_id` | TEXT | Wix auto |
| `ownerId` | TEXT | Wix member id of creator |
| `title` | TEXT | form title |
| `description` | TEXT | optional subtitle |
| `slug` | TEXT | unique, URL-safe |
| `templateId` | TEXT | parking\|event\|contact\|complaint\|custom |
| `fields` | TEXT (JSON) | serialized `FieldConfig[]` |
| `theme` | TEXT (JSON) | serialized `FormTheme` (accent color, etc.) |
| `published` | BOOLEAN | |
| `submissionCount` | NUMBER | denormalized counter (best-effort) |

**`Submissions`**
| field | type | notes |
|-------|------|-------|
| `_id` | TEXT | Wix auto |
| `formId` | TEXT | FK → Forms._id (indexed query key) |
| `ownerId` | TEXT | denormalized for quota queries |
| `data` | TEXT (JSON) | flat `{ fieldId: value }` |
| `exported` | BOOLEAN | |

Permissions: `Forms` insert/read/update/remove = ADMIN (all access via ApiKey
server-side, owner-scoped in code). `Submissions` insert = ANYONE (public submit),
read/update/remove = ADMIN.

> **Storage note:** JSON stored as TEXT because Wix Data OBJECT fields are awkward to
> create via REST. Server parses on read. A single form rarely exceeds a few thousand
> rows, so field-level search happens client-side in the admin panel.

### FieldConfig schema (`form-schema.ts`)

```ts
type FieldType = "text" | "textarea" | "phone" | "email" | "number"
               | "select" | "radio" | "checkbox" | "date";

interface FieldConfig {
  id: string;            // stable nanoid within the form
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];    // select/radio/checkbox
  dir?: "rtl" | "ltr" | "auto";
}

interface FormTheme {
  accent: string;        // hex, drives button/focus color
  dir: "rtl" | "ltr";
}
```

A **field-type registry** maps each `FieldType` → { label, icon, defaultConfig,
renderInput }. Adding a field type is one registry entry.

## Marketing Homepage

Server-rendered, zero client JS on the landing route (islands are opt-in per section
but v1 keeps it pure HTML/CSS for PageSpeed). Sections:

1. **Nav** — logo, links (Features, Pricing, FAQ), "Sign in" + "Start free" CTA.
2. **Hero** — headline, subhead, primary CTA, secondary CTA, animated builder mockup
   (pure CSS/SVG, no JS). Trust line ("Built on Wix").
3. **Logo/social-proof strip** — "Powering registrations for buildings, events, clinics".
4. **Features grid** — drag-and-drop builder, templates, public links, admin panel,
   CSV export, duplicate detection, RTL/multi-language, no-code.
5. **Showcase** — visual of the builder + a rendered form side by side.
6. **How it works** — 3 steps (Pick a template → Customize → Publish & share).
7. **Pricing** — Free vs Pro cards (monthly).
8. **FAQ** — 6 Q&A (accessible `<details>`).
9. **Final CTA** — big banner.
10. **Footer** — links, copyright.

Design language: modern SaaS — generous whitespace, a bold accent gradient
(indigo→violet), rounded-2xl cards, soft shadows, Heebo/Inter type. Bilingual-ready
but marketing copy in English (product supports RTL forms). Fully responsive,
accessible (semantic landmarks, focus states, reduced-motion respected).

## Form Builder (dnd-kit)

Three-pane layout (responsive → stacks/tabs on mobile):

- **Left — Field Palette:** draggable field-type chips. Drag onto canvas to add.
- **Center — Canvas:** sortable list of `FieldCard`s (dnd-kit `SortableContext`).
  Drag handle reorders; click selects; delete button. Empty state prompts drag.
- **Right — Settings/Preview:** tabs. Settings edits the selected field
  (label, placeholder, required, options for choice types). Preview renders the live
  form via the shared `FormRenderer` in disabled mode.

Top bar: editable title, accent color picker, RTL/LTR toggle, "Save" (debounced
auto-save via PATCH), "Publish" (sets published, shows shareable URL modal).

Drag semantics: dnd-kit `DndContext` with a palette droppable→canvas add, plus
canvas `SortableContext` for reorder. Keyboard accessible (dnd-kit KeyboardSensor).
Autosave debounced 1s; explicit Save button flushes.

## Public Form + Submission

`/f/[slug].astro`: server fetches form by slug via ApiKey client. If not found or
`published=false` → friendly "not available" page. Renders `FormRenderer` island
with `fields`, `theme`, `formId`.

`FormRenderer.tsx`: builds inputs from `FieldConfig[]` via the registry. Client-side
required validation. Submit → POST `/api/submit` `{ formId, data }`. On success shows
inline thank-you (no reload). Phone fields `dir=ltr`.

`/api/submit.ts`: validates form exists + published; validates required fields
present; enforces submission quota for the owner's plan; inserts into `Submissions`
via ApiKey; increments `submissionCount` best-effort. Optional duplicate guard when a
form has a phone/email field (409 on repeat within the same form). Returns 201 or
4xx with a message.

## Admin Panel (per form)

`/dashboard/forms/[id]/submissions.astro`: auth-gated; verifies
`form.ownerId === currentMemberId`. Fetches submissions for the form. Renders
`SubmissionsPanel` island.

`SubmissionsPanel.tsx` (ported from Pichman `AdminPanel`, generalized):
- Dynamic columns from `form.fields` (label headers, values from `data` JSON).
- Stats: total / new / exported / duplicates.
- Search across all field values.
- Filters: all / new / exported.
- Select-all + per-row select.
- **CSV export** (columns follow field order, headers = labels) + mark exported.
- **Duplicate detection** (by phone-like + name-like fields; generalized) + select.
- **Bulk delete** with confirm.
- Mobile responsive.

## Auth

Wix OAuth / Members (ported HTTPS-forcing `login.ts`). Dashboard + form-management
routes redirect visitors to login. Public form + marketing are open. Per-form access
is owner-scoped server-side (never trust client). No secondary email allowlist —
any Wix member is a creator.

## Freemium (`plan.ts`)

- **Free:** 1 published form, 100 submissions/month.
- **Pro (monthly):** unlimited forms + submissions.
- Plan detected via Wix Pricing Plans membership for the current member. Quota checks:
  form-count on publish, submission-count on submit. Over-limit → friendly upgrade
  prompt (dashboard) / 429 with upgrade message (submit).
- v1 ships the gate + copy; the actual Pricing Plan product is configured in the Wix
  dashboard (documented in README). If no plan product exists yet, `plan.ts` treats
  everyone as free and enforces free limits.

## SEO & Performance

- `Seo.astro`: title, description, canonical, OG + Twitter tags, `og:image`,
  JSON-LD (`SoftwareApplication` on home, `WebSite` sitewide).
- `sitemap.xml.ts` + `robots.txt.ts` generated server-side. Marketing pages indexable;
  dashboard + published forms `noindex` (published forms are private links).
- Landing route ships **zero JS** (no islands). Fonts preconnected + `display=swap`.
  Images lazy, width/height set. Tailwind v4, minimal CSS. Target Lighthouse ≥95.

## Error Handling & Resilience

- All server fetches wrapped; user-facing error states (never a blank 500).
- ApiKey client is a module singleton (stateless).
- Bulk operations via `bulkPatch`/`bulkRemove` (1 call for N rows).
- Slug collisions avoided via nanoid suffix; unique-check on create.
- Submit endpoint is idempotent-friendly (duplicate guard) and validates server-side.
- Quota failures degrade gracefully to free-tier enforcement if Pricing Plans API
  is unavailable.

## Testing Strategy (pragmatic, non-TDD)

- Pure logic unit-tested where it carries risk: slug generation, duplicate detection,
  required-field validation, quota math, CSV building. (Vitest, colocated.)
- Manual smoke: create form → add/reorder fields → publish → submit → admin export.
- Build gate: `astro build` must pass clean before release.
