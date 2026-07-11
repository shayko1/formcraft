# Responses Analytics Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-executing-plans to implement this plan task-by-task.

**Goal:** Add performance + response insights overview above the responses table, with view/start tracking on public forms.

**Architecture:** Denormalized `viewCount`/`startCount` on Forms; public track API; FormRenderer session-deduped events; client-side insights computed from submissions + form counters; CSS-only charts.

**Tech Stack:** Astro SSR, React islands, Tailwind v4, Wix Data (elevated admin)

---

### Task 1: Data model + track API

**Files:**
- Modify: `src/lib/forms.ts`, `scripts/create-collections.mjs`
- Create: `src/lib/analytics.ts`, `src/pages/api/analytics/track.ts`, `scripts/add-analytics-fields.mjs`

**Steps:** Add `viewCount`/`startCount` to Form map/create/update; pure helpers for daily counts + choice breakdowns + completion rate; public POST track endpoint; patch script for existing Forms collection.

### Task 2: Instrument public form

**Files:**
- Modify: `src/components/FormRenderer.tsx`

**Steps:** On mount (not preview) fire view once per session; on first focus/change fire start once; fire-and-forget fetch.

### Task 3: Insights UI on responses page

**Files:**
- Create: `src/components/SubmissionsInsights.tsx`
- Modify: `src/components/SubmissionsPanel.tsx`, `src/pages/dashboard/forms/[id]/submissions.astro`

**Steps:** KPI cards + 14-day bars + choice charts; pass view/start counts; replace pill stats.

### Task 4: Verify + release

Build, smoke-check types, `npm run release`.
