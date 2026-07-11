# Mobile Form Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the form builder usable on mobile without changing the desktop editor.

**Architecture:** CSS/breakpoint isolation in existing builder components. Mobile-only horizontal palette, always-visible field actions, TouchSensor, Settings back nav. Shared state in `FormBuilder` unchanged.

**Tech Stack:** React, Tailwind, @dnd-kit (PointerSensor + TouchSensor)

---

### Task 1: Mobile horizontal palette + hide desktop palette on mobile

**Files:**
- Modify: `src/components/builder/Palette.tsx` (optional variant) OR inline strip in `FormBuilder.tsx`
- Modify: `src/components/builder/FormBuilder.tsx`

- [x] **Step 1:** Mark desktop palette aside `hidden lg:block` (keep `tab === "build"` for mobile was showing it — stop showing vertical palette on mobile)
- [x] **Step 2:** Add mobile chip strip above canvas (`lg:hidden`, only when `tab === "build"`) calling `addField`
- [x] **Step 3:** Update canvas empty-state copy for mobile (tap above)

### Task 2: Touch FieldCard actions

**Files:**
- Modify: `src/components/builder/FieldCard.tsx`

- [x] **Step 1:** Duplicate/delete always visible below `lg`; hover-reveal on `lg+`
- [x] **Step 2:** Slightly larger drag handle hit area on mobile

### Task 3: TouchSensor + Settings back + top bar polish

**Files:**
- Modify: `src/components/builder/FormBuilder.tsx`

- [x] **Step 1:** Import `TouchSensor`; add with delay/tolerance; keep PointerSensor → MouseSensor + TouchSensor
- [x] **Step 2:** Mobile “← Fields” on Settings panel → `setTab("build")`
- [x] **Step 3:** Compact top bar: Responses as icon-only on small screens if needed

### Task 4: Verify

- [x] **Step 1:** Mentally/CSS check all mobile UI is `lg:hidden` or default that desktop overrides
- [x] **Step 2:** Confirm desktop Edit/Live, full preview, vertical palette untouched

## Spec coverage

| Spec requirement | Task |
|------------------|------|
| Horizontal chip strip | Task 1 |
| Hide vertical palette on mobile | Task 1 |
| Always-visible field actions | Task 2 |
| TouchSensor | Task 3 |
| Settings ← Fields | Task 3 |
| Desktop unchanged | Task 4 |
