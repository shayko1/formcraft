# Multi-Entry + Form Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline — user delegated “decide for me” + deploy). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Opt-in Pichman-style multi-entry on public forms, plus curated page background and card style presets in the editor Design panel.

**Architecture:** Extend `FormTheme` JSON (no CMS migration). `FormRenderer` owns multi-row state and parallel `POST /api/submit`. `/f/[slug].astro` applies page/card chrome from theme presets. Design controls live in `FormBuilder` Design panel.

**Tech Stack:** Astro SSR, React islands, existing Tailwind utility classes, existing `/api/submit`.

## Global Constraints

- No new CMS fields — only `Forms.theme` JSON.
- `allowMultipleEntries` default false.
- No automated test suite in repo — verify with typecheck/build + manual checklist.
- Do not commit unrelated dirty files (analytics, etc.).

---

## File map

| File | Responsibility |
|------|----------------|
| `src/lib/form-schema.ts` | Types, defaults, page-background preset metadata + CSS helpers |
| `src/components/FormRenderer.tsx` | Multi-entry UI + submit-all |
| `src/pages/f/[slug].astro` | Page background + card wrapper from theme |
| `src/components/builder/FormBuilder.tsx` | Design panel controls + preview chrome |

---

### Task 1: Extend FormTheme schema + preset helpers

**Files:**
- Modify: `src/lib/form-schema.ts`

- [ ] **Step 1: Add types and defaults**

Extend `FormTheme` and `DEFAULT_THEME`:

```ts
export type PageBackgroundPreset =
  | "slate"
  | "sand"
  | "mint"
  | "blush"
  | "ink"
  | "brand";

export type CardStyle = "elevated" | "bordered" | "plain";

export interface FormTheme {
  accent: string;
  dir: "rtl" | "ltr";
  submitLabel?: string;
  thankYouTitle?: string;
  thankYouMessage?: string;
  allowMultipleEntries?: boolean;
  addEntryLabel?: string;
  pageBackground?: PageBackgroundPreset;
  cardStyle?: CardStyle;
}

export const DEFAULT_THEME: FormTheme = {
  accent: "#4f46e5",
  dir: "rtl",
  submitLabel: "Submit",
  thankYouTitle: "Thank you!",
  thankYouMessage: "Your response has been recorded.",
  allowMultipleEntries: false,
  addEntryLabel: "Add another response",
  pageBackground: "slate",
  cardStyle: "elevated",
};
```

- [ ] **Step 2: Add preset maps used by Astro + builder**

```ts
export const PAGE_BACKGROUNDS: {
  id: PageBackgroundPreset;
  label: string;
  /** Tailwind classes for body/main (ink uses dark). brand uses CSS var. */
  bodyClass: string;
  swatch: string; // for editor swatch (CSS color or gradient)
}[] = [
  { id: "slate", label: "Slate", bodyClass: "bg-slate-50 text-slate-900", swatch: "#f8fafc" },
  { id: "sand", label: "Sand", bodyClass: "bg-amber-50 text-slate-900", swatch: "#fffbeb" },
  { id: "mint", label: "Mint", bodyClass: "bg-emerald-50 text-slate-900", swatch: "#ecfdf5" },
  { id: "blush", label: "Blush", bodyClass: "bg-rose-50 text-slate-900", swatch: "#fff1f2" },
  { id: "ink", label: "Ink", bodyClass: "bg-slate-950 text-slate-100", swatch: "#020617" },
  { id: "brand", label: "Brand wash", bodyClass: "text-slate-900", swatch: "brand" },
];

export const CARD_STYLES: { id: CardStyle; label: string; className: string }[] = [
  {
    id: "elevated",
    label: "Elevated",
    className: "rounded-3xl bg-white p-6 shadow-xl shadow-slate-900/5 ring-1 ring-slate-100 sm:p-8",
  },
  {
    id: "bordered",
    label: "Bordered",
    className: "rounded-3xl bg-white p-6 ring-2 ring-slate-200 sm:p-8",
  },
  {
    id: "plain",
    label: "Plain",
    className: "rounded-2xl bg-white/80 p-6 sm:p-8",
  },
];

export function resolvePageBackground(theme: FormTheme): {
  bodyClass: string;
  style?: Record<string, string>;
} {
  const id = theme.pageBackground ?? "slate";
  const preset = PAGE_BACKGROUNDS.find((p) => p.id === id) ?? PAGE_BACKGROUNDS[0];
  if (id === "brand") {
    const accent = theme.accent || DEFAULT_THEME.accent!;
    return {
      bodyClass: preset.bodyClass,
      style: {
        background: `color-mix(in srgb, ${accent} 14%, white)`,
      },
    };
  }
  return { bodyClass: preset.bodyClass };
}

export function resolveCardClass(theme: FormTheme): string {
  const id = theme.cardStyle ?? "elevated";
  return (CARD_STYLES.find((c) => c.id === id) ?? CARD_STYLES[0]).className;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/form-schema.ts
git commit -m "feat(theme): multi-entry flags and page/card design presets"
```

---

### Task 2: FormRenderer multi-entry

**Files:**
- Modify: `src/components/FormRenderer.tsx`

- [ ] **Step 1: Refactor values to rows when `allowMultipleEntries`**

Keep single-row path when flag is false (wrap current values as one conceptual row or branch).

When true:

- `rows: Values[]` starting `[ {} ]`
- Map each row into a bordered card; show × remove if `rows.length > 1`
- Dashed add button with `addEntryLabel`
- Per-row errors: `Record<number, Record<string, string>>`
- Submit: validate all rows; `Promise.allSettled` POSTs; thank-you only if all ok; else message like `Saved 2 of 3 responses. Fix the errors and try again.` (and drop successfully saved rows from state if identifiable — simpler: keep all rows, show which indices failed via message)

Simplest partial-failure UX from spec: keep form filled, show counts.

- [ ] **Step 2: Commit**

```bash
git add src/components/FormRenderer.tsx
git commit -m "feat(form): opt-in multi-entry submit like Pichman"
```

---

### Task 3: Public page chrome

**Files:**
- Modify: `src/pages/f/[slug].astro`

- [ ] **Step 1: Apply resolvePageBackground + resolveCardClass**

Import helpers from `form-schema`. Set `bodyClass` on Layout (merge with text colors). For brand, pass inline style on `<main>` or wrapper. Wrap FormRenderer with `resolveCardClass(theme)`.

Ink preset: ensure card stays white / readable; footer link contrast (`text-slate-400` ok on ink).

- [ ] **Step 2: Commit**

```bash
git add src/pages/f/[slug].astro
git commit -m "feat(public): apply theme page background and card style"
```

---

### Task 4: Editor Design controls + preview chrome

**Files:**
- Modify: `src/components/builder/FormBuilder.tsx`

- [ ] **Step 1: Design panel UI**

After thank-you message fields, add:

1. Toggle `allowMultipleEntries` + conditional `addEntryLabel` input
2. Page background swatches from `PAGE_BACKGROUNDS`
3. Card style segmented control from `CARD_STYLES`

- [ ] **Step 2: Preview wrappers**

Live preview + full preview: wrap `FormRenderer` in a mini page chrome using `resolvePageBackground` + `resolveCardClass` so owners see backgrounds.

- [ ] **Step 3: Commit**

```bash
git add src/components/builder/FormBuilder.tsx
git commit -m "feat(builder): design controls for multi-entry and page look"
```

---

### Task 5: Build + release

- [ ] **Step 1:** `npm run build` — fix any errors
- [ ] **Step 2:** `npm run release` — deploy to Wix host
- [ ] **Step 3:** Smoke-check public URL if possible

---

## Manual test checklist

1. Default form: no add button, slate elevated look.
2. Enable multi-entry, add 2 rows, submit → 2 admin responses.
3. Cycle backgrounds + card styles in preview and published page.
4. Preview submit disabled; add/remove works in preview.
