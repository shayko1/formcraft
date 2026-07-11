# Custom Export + Internal Fields — Design Spec

**Date:** 2026-07-11  
**Status:** Approved (user chose A→C→A→A→Approach 1; backward compatibility required)

## Summary

Extend the Responses panel with **custom CSV export** (pick columns) and **per-form internal fields** (admin-only text/select columns). Internal field values are editable only in a response detail panel; public form answers stay read-only. Export continues to **mark responses as exported** after a successful download.

## Goals

- Let owners export only the columns they need.
- Let owners attach admin metadata (status, notes, etc.) that respondents never see.
- Keep existing forms and exports working with no required migration of submission data.

## Non-Goals (this pass)

- Saved export presets
- Editing submitted (public) answers
- Full field-type parity for internal fields (no phone/email/date/file)
- Inline editing of internal values in the table
- Showing internal columns as primary table columns (v1)

## Locked decisions

| Topic | Choice |
|-------|--------|
| Internal field definitions | Per form in builder (schema on Form) |
| Internal field types | `text` + `select` only |
| Value storage | Same submission `data` blob under internal field IDs |
| Custom export | One-off column picker modal; all columns selected by default |
| Edit UX | Click row → detail panel; answers read-only; only internal fields editable |
| Mark exported | Always after successful CSV build (unchanged behavior) |
| Architecture | Approach 1 — schema on Form, values in `data` |
| Backward compatibility | Missing `internalFields` → `[]`; export without `fieldIds` → all columns |

## Architecture

```
Form builder (Settings tab)
  Internal fields editor
    → PATCH /api/forms/:id { internalFields }
         → Form.internalFields (JSON)

Public submit
  POST /api/submit { formId, data }
    → accept only public field IDs
    → strip unknown / internal keys
    → insertSubmission

Responses panel
  Export selected / Export all
    → column picker modal
    → POST /api/submissions/export { formId, ids, fieldIds? }
         → buildCsv(selected columns)
         → markExported(selected)

  Click row → detail panel
    → read-only answers
    → editable internal fields
    → POST /api/submissions/update-internal { formId, submissionId, data }
         → merge only internal field keys into submission.data
```

## Data model

### Forms collection

New TEXT field (JSON string), same pattern as `fields`:

- `internalFields`

Shape:

```ts
type InternalFieldType = "text" | "select";

interface InternalFieldConfig {
  id: string;
  type: InternalFieldType;
  label: string;
  options?: string[]; // required for select (same convention as form select)
}
```

`mapForm` / readers: `parseJson(r.internalFields, [])`.  
Forms created before this change: no key → `[]`. No submission backfill needed.

Collection migration: add `internalFields` via a small script (same pattern as analytics fields), and update `scripts/create-collections.mjs` for new sites.

### Submissions

No new collection fields. Values for internal fields live in existing `data` JSON under the internal field `id`s.

## API

### `PATCH /api/forms/:id`

Accept optional `internalFields: InternalFieldConfig[]` in `FormPatch`. Owner auth unchanged. Autosave from builder includes it alongside `fields` / `theme`.

### `POST /api/submit`

Before insert:

1. Validate against public `form.fields` only (existing).
2. Build a filtered payload: only keys in `form.fields.map(f => f.id)`.
3. Insert that filtered object (never persist internal or unknown keys from the client).

### `POST /api/submissions/update-internal`

Body: `{ formId: string, submissionId: string, data: Record<string, unknown> }`

Rules:

- Owner of the form only
- Submission must belong to that form
- Allowed keys = `form.internalFields` IDs only; ignore / reject others
- For `select` fields, value must be empty or one of `options`
- Full-record update (same pattern as `markExported`): merge allowed keys into existing `data`, preserve `exported` and public answers

### `POST /api/submissions/export`

Body: `{ formId: string, ids: string[], fieldIds?: string[] }`

Rules:

- Owner + plan-visible rows only (existing)
- Column sources: public fields + internal fields + synthetic `_createdDate` ("Submitted")
- If `fieldIds` is omitted/`undefined` → use all columns (backward compatible default for old clients)
- If `fieldIds` is present (including `[]`) → use only IDs that match known columns; if the resolved set is empty → `400` (do not mark exported)
- Build CSV with selected headers only
- Call `markExported(selected)` only after CSV is built successfully
- Response: CSV download (existing headers)

## UI

### Builder — Settings tab

Section **Internal fields**:

- List of internal fields with label, type (text/select), options editor for select
- Add / remove / reorder
- Not shown on public canvas, preview, or live form
- Persisted via existing debounced autosave

### Responses — Export

- **Export selected** and **Export all** open a modal instead of exporting immediately
- Checklist: every public field, every internal field, Submitted
- Default: all checked
- Confirm → download + mark exported + update local `exported` flags
- Cancel → no download, no mark

### Responses — Detail panel

- Clicking a row opens a side/detail panel (row click no longer only toggles selection; checkbox still selects for bulk actions)
- Sections: submitted answers (read-only), internal fields (editable inputs), Save / Close
- Save calls `update-internal` and updates local row state
- If `internalFields` is empty, panel still shows answers; no edit section (or a short empty hint)

## Edge cases

| Case | Behavior |
|------|----------|
| Existing forms | `internalFields = []`; export/UI unchanged aside from picker defaulting to all public columns + Submitted |
| Delete internal field in builder | Hidden from UI/export; stale keys may remain in `data` (harmless) |
| Relabel internal field | Same `id`; values keep working |
| Empty column selection | Block confirm; show short error |
| Export API failure | Do not mark exported |
| Public client sends internal IDs | Stripped on submit |

## Testing (manual)

1. Old form (no internal fields): export still works; picker shows public fields + Submitted; marks exported.
2. Add internal text + select; save form; public form does not show them.
3. Submit a response; detail panel shows empty internal fields; edit + save; reload persists.
4. Custom export with subset of columns; CSV headers/rows match; status becomes exported.
5. Submit with forged internal keys in payload; stored `data` has only public keys.
