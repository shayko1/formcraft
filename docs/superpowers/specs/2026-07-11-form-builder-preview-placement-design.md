# Form Builder Live Preview Placement

**Date:** 2026-07-11  
**Status:** Revised — Option C + full preview  
**Scope:** Desktop form editor layout (`FormBuilder.tsx`)

## Problem

Stacking Field settings above a sticky Live preview (Option B) made settings hard to use — too little vertical space and awkward scrolling.

## Goal

Give settings full room to scroll, keep Live one click away, and offer a real full-width form preview.

## Decisions

| Decision | Choice |
|----------|--------|
| Right column | **C** — Edit \| Live tabs |
| Full preview | Top-bar **Preview** / **Back to editor** (desktop) |
| Mobile | Keep Build / Settings / Design / Preview tabs |

## Desktop layout

- **Edit tab:** Field settings + Design, full height of the right column (scroll freely)
- **Live tab:** Compact live preview in the right column; link to open full preview
- **Preview (top bar):** Hides builder chrome; centered form at `max-w-lg` (public-form width)

Selecting a field switches the right pane to **Edit**.

## Mobile

Unchanged tab bar. Preview tab shows the form full-width.

## Out of scope

- Changing Field settings controls
- API / schema changes
