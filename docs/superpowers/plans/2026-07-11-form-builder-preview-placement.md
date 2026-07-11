# Form Builder Preview Placement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Live preview always visible on desktop by placing Field settings + Design above a sticky preview pane in the form editor right column.

**Architecture:** CSS/layout-only change in `FormBuilder.tsx`. Wrap Settings + Design in a scroll-capped top pane (`max-h-[40vh] overflow-y-auto` on `lg+`); keep Live preview below with the right column sticky to the viewport. Mobile tabs unchanged.

**Tech Stack:** React, Tailwind CSS, existing `FormRenderer` preview mode

## Global Constraints

- Touch only `src/components/builder/FormBuilder.tsx` for the layout change
- No API, schema, DnD, or FormRenderer behavior changes
- Mobile: Build / Settings / Design / Preview tabs behave as today
- Preview width remains the existing ~320px right column

---

### Task 1: Restructure right column (settings above sticky preview)

**Files:**
- Modify: `src/components/builder/FormBuilder.tsx` (right `<aside>` ~354–456)
- Spec: `docs/superpowers/specs/2026-07-11-form-builder-preview-placement-design.md`

**Interfaces:**
- Consumes: existing `tab`, `selected`, `theme`, `FormRenderer` props — unchanged
- Produces: same UI behavior; new desktop layout structure only

- [x] **Step 1: Replace the right aside structure**
- [ ] **Step 2: Manual verify desktop**
- [ ] **Step 3: Manual verify mobile**
- [ ] **Step 4: Commit** (only if user asks)
---

## Spec coverage

| Spec requirement | Task |
|------------------|------|
| Desktop settings above sticky preview | Task 1 |
| Mobile tabs unchanged | Task 1 (preserve visibility classes) + Step 3 |
| No API/schema changes | Task 1 scope |
| Acceptance: preview updates live | Step 2 |
| Acceptance: DnD/save/publish still work | unchanged code paths |
