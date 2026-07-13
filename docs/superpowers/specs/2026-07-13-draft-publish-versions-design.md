# Draft vs Publish + Versions + Mobile Canvas Scroll

**Date:** 2026-07-13  
**Status:** Approved (Approach 1) — implementing

## Goals

1. **No autosave.** Edits stay local until **Save** (draft) or **Publish** (live).
2. **Draft ≠ live.** Public `/f/:slug` serves the last published snapshot only.
3. **Versions.** Each Publish creates a version; keep last **10**. **Restore** loads a version into the draft only (Publish again to go live).
4. **Unsaved warning** on leave / in-app navigate when dirty.
5. **Mobile:** Build tab / canvas must scroll so freeform is usable.

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Save model | Explicit Save + Publish only (no autosave) |
| Restore | Draft only |
| Version cap | 10 |
| Leave dirty | Hard warn (`beforeunload` + confirm) |
| Architecture | Draft on form + `live` blob + versions collection |

## Data model

### Form document (existing `Forms` collection)

- Draft content remains: `title`, `description`, `fields`, `theme`, `internalFields`
- New field `live` (JSON string): `{ title, description, fields, theme, publishedAt, version }` or empty when never published
- `published: boolean` — accepting responses; public reads `live` when true

**Back-compat:** If `published` and `live` missing, treat current draft fields as live until next Publish (lazy).

### `FormVersions` collection (new)

| Field | Type |
|-------|------|
| formId | string |
| version | number |
| title, description | string |
| fields, theme | JSON string |
| createdDate | string (ISO) |

Prune oldest when count > 10 for a formId.

## API

- `PATCH /api/forms/:id` — **draft only** (never updates `live`; ignore/reject using this for publish)
- `POST /api/forms/:id/publish` — save draft → copy to `live`, set `published: true`, insert version, prune
- `POST /api/forms/:id/unpublish` — `published: false` (keep `live` for republish)
- `GET /api/forms/:id/versions` — list (newest first)
- `POST /api/forms/:id/versions/:versionId/restore` — copy snapshot into draft fields

## Editor UX

- Remove debounced autosave `useEffect`
- Dirty flag vs last-saved draft snapshot
- Save → PATCH draft; clear dirty
- Publish → confirm if dirty (save+publish) or publish; show link modal
- Versions panel (Design/Settings or Publish menu): list + Restore
- Status: `Unsaved` / `Saved draft` / `Published` / `Draft ahead of live`

## Public + submit

- `/f/[slug].astro` renders `live` content (fallback draft if legacy)
- `/api/submit` validates against **live** fields when published

## Mobile scroll

- Do not lock `html/body` overflow on small screens (or only lock on `lg+`)
- Build column: `overflow-y-auto` on mobile
- Canvas: `touch-none` only on drag handle / resize, not whole field chrome
- Keep canvas viewport `overflow-y-auto` so the artboard can be panned/scrolled

## Out of scope

- Branching / named versions
- Diff UI between versions
- Autosave drafts to server

## Ops note

Create a Wix CMS collection **`FormVersions`** (or ensure auto-create on first insert) with fields:
`formId` (text), `version` (number), `title`, `description`, `fields` (text/json), `theme` (text/json), `createdDate` (text/datetime).
Also add optional **`live`** (text) on the existing **Forms** collection for the published snapshot JSON.
