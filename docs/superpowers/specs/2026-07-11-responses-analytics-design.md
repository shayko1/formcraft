# Responses Analytics — Design Spec

**Date:** 2026-07-11  
**Status:** Approved (user chose C→A→A→A; remaining decisions locked by agent per “decide for me and deploy”)

## Summary

Add an **insights overview strip** above the responses table so form owners immediately see performance and answer patterns. Combines industry-standard big-picture metrics (views / starts / submissions / completion) with response insights (activity over time, choice-field breakdowns, export backlog).

## Goals

- Make “what’s happening now” obvious without opening spreadsheets.
- Match FormCraft clay / soft-brand visual language.
- Reuse existing submission data; add minimal instrumentation for views and starts.

## Non-Goals (this pass)

- Per-field drop-off funnels
- Device / geo / traffic-source analytics
- Date-range filters UI (lifetime KPIs + fixed last-14-days chart)
- Separate Insights tab or shareable report builder
- Chart libraries (CSS bars only)

## Locked decisions

| Topic | Choice |
|-------|--------|
| Scope | Performance + response insights |
| Performance depth | Views (page load) + Starts (first interaction) + Submissions + Completion rate |
| Layout | Overview strip above the existing table |
| Answer charts | Yes — select / radio / checkbox horizontal bars |
| View/start storage | Denormalized `viewCount` / `startCount` on Forms (like `submissionCount`) |
| Deduping | `sessionStorage` once per form per browser session |
| Activity chart | Submissions per day, last 14 days (from `createdDate`) |
| Completion rate | `submissions / starts` when starts > 0; else `submissions / views` when views > 0; else `—` |
| Preview | Builder preview must **not** fire analytics |

## Architecture

```
Public form (/f/[slug])
  FormRenderer (not preview)
    → sessionStorage gate
    → POST /api/analytics/track { formId, event: "view"|"start" }
         → increment Form.viewCount | Form.startCount

Responses page
  SubmissionsPanel
    → InsightsOverview (KPI cards + 14-day bars + choice breakdowns)
    → existing filters / table / export
```

### Data model (Forms collection)

New NUMBER fields:

- `viewCount` (default 0)
- `startCount` (default 0)

`updateForm` must always persist these on full-document replace (same pattern as `submissionCount`).

### API

`POST /api/analytics/track` — public, no auth

Body: `{ formId: string, event: "view" | "start" }`

Rules:

- Form must exist and be published
- Best-effort increment; never throws to the respondent UI (client fire-and-forget)
- Reject unknown events / missing formId

### Insights computed client-side from loaded rows

From visible submissions (already plan-gated on the page):

- New / Exported / Duplicates (existing logic)
- Last-14-days daily counts
- Per choice-field option tallies + percentages

Lifetime Views / Starts / Completion come from form counters passed as props (not limited by free-tier visible-row cap — counters reflect all traffic).

## UI

1. **KPI row** — cards: Views, Starts, Responses, Completion %, New, Exported  
   Soft pastel fills using brand tokens; Completion shows `%` or `—`.
2. **Activity** — “Last 14 days” labeled bar strip; empty state when no submissions in range.
3. **Answer summaries** — one block per select/radio/checkbox field with horizontal bars.
4. **Table** — unchanged behavior; replace the current small Total/New/Exported pills with the KPI strip (duplicates control stays near filters or as a small chip).

## Error handling

- Track API failures are silent on the public form.
- Missing counters treat as 0 (old forms before migration).
- Collection schema: add fields via `scripts/create-collections.mjs` + one-shot field patch if collection already exists.

## Testing

- Preview mode does not call track.
- Published form: one view + one start per session.
- Insights render with zero submissions (zeros / empty chart).
- Choice charts ignore text/email/phone fields.
