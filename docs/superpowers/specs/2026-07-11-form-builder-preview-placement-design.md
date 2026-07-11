# Form Builder Live Preview Placement

**Date:** 2026-07-11  
**Status:** Approved for planning  
**Scope:** Desktop form editor layout only (`FormBuilder.tsx`)

## Problem

In the form editor, Live preview sits at the bottom of the right column, under Field settings and Design. On desktop, users must scroll past those panels to find the preview — it feels buried and hard to discover.

## Goal

Make the live preview always visible on desktop while editing, without changing mobile tabs, DnD, autosave, or form schema/APIs.

## Decisions

| Decision | Choice |
|----------|--------|
| Overall approach | Always-visible preview as a first-class right-column panel |
| Settings placement | **B** — Field settings + Design above sticky Live preview |
| Mobile | Keep existing Build / Settings / Design / Preview tabs |
| Preview width | Keep ~320px right column (no wider preview in this change) |

## Desktop layout

Three columns (unchanged grid intent):

```
[ Palette 220px ] [ Canvas flex ] [ Right ~320px ]
```

Right column structure:

1. **Top pane (scrollable)** — Field settings, then Design (accent, direction, submit/thank-you copy). Height is capped so the preview remains in the first viewport.
2. **Bottom pane (sticky)** — Live preview via existing `FormRenderer` with `preview`. Stays in view while the top pane scrolls.

Sticky behavior: the preview pane uses `position: sticky` (anchored within the right column / viewport) so scrolling settings never hides it.

## Mobile layout (&lt; lg)

Unchanged:

- Tab bar: Build | Settings | Design | Preview
- Selecting a field still switches to Settings
- Preview remains a full-width dedicated tab

## Components & data flow

- **Touch:** `src/components/builder/FormBuilder.tsx` structure and CSS classes only
- **Reuse:** `FormRenderer`, `SettingsPanel`, palette, canvas, DnD — no logic changes required
- **No changes:** APIs, `form-schema`, autosave, publish modal, public form pages

## Out of scope

- Wider or full-bleed preview
- Separate preview window / drawer
- Redesigning Field settings or Design controls
- Making the canvas itself the live form

## Acceptance criteria

1. On `lg+` viewports, Live preview is visible without scrolling past Settings/Design.
2. Scrolling a long settings list does not push preview out of view (sticky bottom pane).
3. Mobile tab behavior matches today.
4. Live preview still updates as title, fields, and theme change.
5. Drag-and-drop, select, delete, duplicate, autosave, and publish still work.

## Implementation notes

- Prefer CSS/`flex` split in the right `<aside>` over new components.
- Right column: `flex flex-col` with top pane `max-h-[40vh] overflow-y-auto` and bottom preview `sticky top-4` (or flex-1 with sticky) so preview stays in view.
- Keep existing `hidden lg:block` / tab visibility patterns for mobile.
