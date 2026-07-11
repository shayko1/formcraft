# Custom Export + Internal Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-form internal fields (text/select) editable on responses, plus a column-picker CSV export that still marks rows exported.

**Architecture:** `internalFields` JSON on Form (defaults `[]`); values in submission `data`; submit strips non-public keys; update-internal merges only internal keys; export accepts optional `fieldIds`.

**Tech Stack:** Astro SSR, React islands, Tailwind, Wix Data admin

## Global Constraints

- Backward compatible: missing `internalFields` → `[]`; export without `fieldIds` → all columns
- Public answers never editable; only internal fields editable in detail panel
- Mark exported only after successful CSV build

---

### Task 1: Schema + data layer + migration

**Files:**
- Modify: `src/lib/form-schema.ts`, `src/lib/forms.ts`, `scripts/create-collections.mjs`
- Create: `scripts/add-internal-fields.mjs`
- Modify: `src/lib/submissions.ts` (add `updateInternalData`)

- [x] Add `InternalFieldConfig` types to form-schema
- [x] Wire `internalFields` through Form map/create/update/FormPatch
- [x] Collection script + migration script
- [x] `updateInternalData(sub, patch)` full-record merge helper

### Task 2: APIs

**Files:**
- Modify: `src/pages/api/forms/[id].ts`, `src/pages/api/submit.ts`, `src/pages/api/submissions/export.ts`
- Create: `src/pages/api/submissions/update-internal.ts`

- [x] PATCH accepts `internalFields`
- [x] Submit filters to public field IDs only
- [x] Export supports `fieldIds` (undefined = all; empty resolved = 400)
- [x] update-internal endpoint (owner, validate select options)

### Task 3: Builder — internal fields editor

**Files:**
- Create: `src/components/builder/InternalFieldsEditor.tsx`
- Modify: `src/components/builder/FormBuilder.tsx`, builder page props if needed

- [x] Settings-tab section to add/edit/remove text+select internal fields
- [x] Autosave includes `internalFields`

### Task 4: Responses — export picker + detail panel

**Files:**
- Modify: `src/components/SubmissionsPanel.tsx`, `src/pages/dashboard/forms/[id]/submissions.astro`

- [x] Pass `internalFields` into panel
- [x] Export modal with column checkboxes
- [x] Row click → detail panel (answers RO, internal editable, save)

### Task 5: Verify

- [x] Typecheck/build; smoke manual checklist from spec
- [x] Ran `node scripts/add-internal-fields.mjs` (field added)