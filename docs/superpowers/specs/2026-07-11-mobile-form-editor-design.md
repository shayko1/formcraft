# Mobile Form Editor

**Date:** 2026-07-11  
**Status:** Approved — Option A (mobile shell polish)  
**Scope:** Mobile (`<lg`) form builder UX in `FormBuilder.tsx` + related builder components  
**Constraint:** Desktop (`lg+`) editor layout and behavior must not change

## Problem

The builder already isolates mobile via tabs, but editing on a phone is awkward:

- Build stacks a full vertical palette above the canvas
- Field delete/duplicate only appear on hover (invisible on touch)
- Scroll vs drag conflicts on touch reorder
- No clear path back from Settings → Build
- Top bar actions wrap and crowd the screen

## Goal

Make mobile editing usable (add, select, edit, reorder, delete, preview, design) without touching the desktop three-column + Edit/Live layout.

## Decision

| Decision | Choice |
|----------|--------|
| Approach | **A** — polish existing mobile tab shell |
| Desktop | Unchanged (all mobile UI via `lg:hidden` / default + `lg:` overrides) |
| Rejected | B (full-screen field editor), C (split Mobile/Desktop builders) |

## Architecture

One `FormBuilder` keeps shared state. Visibility stays CSS-breakpoint driven:

| Viewport | Navigation | Build | Settings / Design / Preview |
|----------|------------|-------|-----------------------------|
| `<lg` | Top tabs | Horizontal field-type strip + canvas | Full-width panels |
| `lg+` | None (3 columns) | Vertical `Palette` sidebar | Edit \| Live right pane |

## Mobile UX

### Build

- Hide the desktop vertical palette (`hidden lg:block` on existing aside)
- Show a mobile-only horizontal chip strip above the canvas (`lg:hidden`)
- Tap a chip → `addField` (existing path); no drag-from-palette required on mobile
- Canvas remains primary; empty state copy: tap a type above

### Field cards

- Always show duplicate/delete on mobile (`opacity-100 lg:opacity-0 lg:group-hover:opacity-100`)
- Keep drag handle; enlarge hit target slightly on mobile

### Touch reorder

- Add `TouchSensor` with `activationConstraint: { delay: 200, tolerance: 8 }` alongside existing `PointerSensor`
- Desktop pointer behavior unchanged (distance: 6)

### Settings

- Selecting a field still switches to Settings on `<lg`
- Mobile “← Fields” button at top of Settings returns to Build
- Desktop settings header unchanged

### Design / Preview

- Keep existing Design and Preview tabs as-is (already full-width on mobile)
- Preview remains the mobile full-width live form (no desktop full-preview button on mobile)

### Top bar (mobile)

- Keep title + Save + Publish visible
- Move Responses into a compact overflow or keep as secondary; prefer wrapping less: hide Responses label text behind icon-only on smallest widths if needed
- Do not show desktop “Preview / Back to editor” on mobile (already `lg:inline-flex`)

## Out of scope

- Splitting into separate Mobile/Desktop components
- Changing Field settings controls or schema
- Changing desktop Edit \| Live or full preview
- API changes

## Acceptance

1. On a phone-width viewport: can add a field, open settings, edit label, return to Build, reorder, delete, change Design, open Preview
2. On `lg+`: three-column layout, Edit/Live tabs, and full preview behave exactly as today
3. Autosave / Publish / Responses still work on both
