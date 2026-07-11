# Multi-Entry Responses + Public Form Design

**Date:** 2026-07-11  
**Status:** Approved (user delegated decisions: “decide for me”)  
**Scope:** Editor Design panel, `FormTheme`, `FormRenderer`, public `/f/[slug]` page shell

## Problem

1. FormCraft public forms only accept one filled set of fields per page load. Parking-style flows (see Pichman) need an opt-in “+ add another” that duplicates the full field set and creates one submission per block on send.
2. Design controls are limited to accent + direction + thank-you copy. Public pages always use the same slate background and white card.

## Goals

- Opt-in **multi-entry** in the editor (off by default), Pichman-style.
- Richer but curated **page / card design** presets the owner can pick in Design.
- Persist via existing `theme` JSON — no CMS schema migration.
- Ship and release (`npm run release`).

## Non-Goals

- Repeating only a subset of fields (always duplicates the whole form).
- Custom CSS / arbitrary background image uploads.
- Conditional logic, multi-page forms, file uploads.
- Changing free-tier quota math beyond counting each inserted row as one response (already true).

## Decisions (locked)

| Decision | Choice |
|----------|--------|
| Multi-entry UX | Pichman pattern: N field-blocks + dashed “add” button + remove on extras; one Submit sends all |
| Opt-in | `theme.allowMultipleEntries` boolean, default `false` |
| Add-button label | `theme.addEntryLabel` string, default `"Add another response"` |
| Submit transport | N parallel `POST /api/submit` calls (reuse existing API + validation + phone duplicate guard) |
| Partial failure | If any insert fails after others succeeded, show error naming how many saved; keep unsaved blocks filled |
| Design surface | Curated presets only (no freeform CSS) |
| Page background | `theme.pageBackground` preset id |
| Card look | `theme.cardStyle`: `elevated` \| `bordered` \| `plain` |
| Defaults | `pageBackground: "slate"`, `cardStyle: "elevated"` — matches today’s look |

## Approaches considered

1. **Theme flags + client multi-POST (chosen)** — Extend `FormTheme`; renderer owns rows; submit loops existing API. Fastest, no backend batch endpoint, matches Pichman.
2. **Batch `/api/submit` with `data[]`** — Cleaner atomicity; more API surface and admin/quota edge cases. Deferred.
3. **Thank-you “submit another” only** — Does not match Pichman’s simultaneous multi-block UX. Rejected for this feature.

## Data model (`FormTheme`)

```ts
interface FormTheme {
  accent: string;
  dir: "rtl" | "ltr";
  submitLabel?: string;
  thankYouTitle?: string;
  thankYouMessage?: string;
  // Multi-entry (opt-in)
  allowMultipleEntries?: boolean; // default false
  addEntryLabel?: string;         // default "Add another response"
  // Public page look
  pageBackground?: PageBackgroundPreset; // default "slate"
  cardStyle?: "elevated" | "bordered" | "plain"; // default "elevated"
}

type PageBackgroundPreset =
  | "slate"   // current soft gray
  | "sand"    // warm neutral
  | "mint"    // cool green wash
  | "blush"   // soft rose
  | "ink"     // dark page, light card
  | "brand";  // soft accent-tinted wash using theme.accent
```

Stored as JSON on `Forms.theme` (already TEXT). Unknown/missing keys fall back to defaults in `DEFAULT_THEME` + merge in renderer / public page.

## Editor (FormBuilder Design panel)

Add below existing thank-you controls:

1. **Multiple responses** — toggle “Allow adding another response”; when on, show text input for add-button label.
2. **Page background** — 6 swatch buttons (one per preset), live preview updates.
3. **Card style** — 3 segmented options: Elevated / Bordered / Plain.

Live + full preview must reflect multi-entry UI (preview mode: add/remove work, submit still disabled) and page/card styling.

## Public form (`/f/[slug].astro` + `FormRenderer`)

### Page shell (`[slug].astro`)

- Apply `pageBackground` as body/main background classes (or inline CSS variables for `brand`).
- Apply `cardStyle` classes on the wrapping card around `FormRenderer`.
- Pass full `theme` through (already done).

### Renderer multi-entry

When `allowMultipleEntries` is false: current single-block behavior (unchanged).

When true:

- State is `rows: Values[]` (start with one empty row).
- Render each row in a card; if `rows.length > 1`, show remove (×) on that row.
- Dashed full-width button uses `addEntryLabel`.
- Validate every row with `validateFields`; highlight errors per row.
- On submit: `Promise.allSettled` of POSTs; success only if all fulfilled → thank-you; else error message with saved/failed counts.
- Phone duplicate guard remains per-row server-side (409 on that row’s request).

## Error handling

| Case | Behavior |
|------|----------|
| Client validation fails | Stay on form; mark invalid fields per row |
| One of N POSTs returns 409/4xx/5xx | Error banner; leave form filled; owner still has successful rows in admin |
| Network failure | Same as today, for the failed requests |

## Testing (manual)

1. New form, Design off → public form looks like today (slate + elevated), no add button.
2. Enable multi-entry → add 2 blocks → submit → 2 rows in submissions admin.
3. Toggle each page background + card style → public page updates after save/publish.
4. Preview in builder mirrors design + multi-entry without posting.
5. Phone duplicate on second block returns clear error; first block may already be saved (documented partial-failure behavior).

## Out of scope / follow-ups

- Atomic multi-insert API
- Cap on max rows (can add later, e.g. 20)
- Per-field “repeat this section only”
