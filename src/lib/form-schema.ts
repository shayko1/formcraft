// Shared, framework-agnostic form schema. Imported by both Astro (server) and
// React islands, so it must stay pure — no JSX, no React, no Wix SDK here.

export type FieldType =
  | "text"
  | "textarea"
  | "phone"
  | "email"
  | "url"
  | "number"
  | "select"
  | "radio"
  | "checkbox"
  | "date"
  | "time"
  | "file"
  | "image"
  | "heading";

/** Freeform canvas position (px). Present → public form uses absolute layout. */
export interface FieldLayout {
  x: number;
  y: number;
  w: number;
  h?: number;
  z: number;
}

/** Per-element visual style (labels, headings, decorative text). */
export interface FieldStyle {
  labelColor?: string;
  labelSize?: number;
  textColor?: string;
  fontSize?: number;
  /**
   * Field chrome fill.
   * - undefined → default soft card (canvas)
   * - `"none"` → transparent / no fill
   * - hex/css color → custom fill
   */
  background?: string;
}

/** Quick picks for per-field background in Settings. */
export const FIELD_BACKGROUND_PRESETS: { id: string; label: string; value: string | undefined }[] = [
  { id: "default", label: "Default", value: undefined },
  { id: "none", label: "None", value: "none" },
  { id: "white", label: "White", value: "#ffffff" },
  { id: "soft", label: "Soft", value: "#f8fafc" },
  { id: "mist", label: "Mist", value: "#e2e8f0" },
  { id: "ink", label: "Ink", value: "#0f172a" },
];

/** Resolve per-field chrome background for editor + public canvas. */
export function resolveFieldBackground(
  style: FieldStyle | undefined,
  opts?: { darkCard?: boolean; /** Soft default fill (canvas editor). */ defaultChrome?: boolean },
): { backgroundColor?: string; className: string } {
  const raw = style?.background?.trim();
  if (raw === "none" || raw === "transparent") {
    return { backgroundColor: "transparent", className: "" };
  }
  if (raw) {
    return { backgroundColor: raw, className: "" };
  }
  if (opts?.defaultChrome) {
    return {
      className: opts?.darkCard ? "bg-white/10" : "bg-white/90",
    };
  }
  return { className: "" };
}

export interface FieldConfig {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  options?: string[]; // select | radio | checkbox
  dir?: "rtl" | "ltr" | "auto";
  /** Number / text length constraints */
  min?: number;
  max?: number;
  /**
   * When true, reject a new submission if this field’s value already exists
   * on another response for the same form.
   */
  unique?: boolean;
  /** Absolute canvas layout. Missing → auto-stacked when opening the editor. */
  layout?: FieldLayout;
  style?: FieldStyle;
  /** Image URL (type === "image"). */
  src?: string;
}

/** Decorative / non-input types — never submitted or validated. */
export function isDecorativeField(type: FieldType): boolean {
  return type === "image" || type === "heading";
}

/** Admin-only columns on responses — never shown on the public form. */
export type InternalFieldType = "text" | "select";

export interface InternalFieldConfig {
  id: string;
  type: InternalFieldType;
  label: string;
  options?: string[]; // select
}

export type PageBackgroundPreset =
  | "slate"
  | "sand"
  | "mint"
  | "blush"
  | "ink"
  | "brand";

export type CardStyle = "elevated" | "bordered" | "plain";

/** `canvas` = freeform absolute layout; `stack` = classic vertical form. */
export type LayoutMode = "canvas" | "stack";

export interface FormTheme {
  accent: string; // hex color, drives buttons + focus rings
  dir: "rtl" | "ltr";
  submitLabel?: string;
  thankYouTitle?: string;
  thankYouMessage?: string;
  /** When true, public form can add multiple field-blocks (Pichman-style). */
  allowMultipleEntries?: boolean;
  /** Label for the dashed “add another” button. */
  addEntryLabel?: string;
  /** When true, skip all unique-field checks on submit (per-field unique flags ignored). */
  allowDuplicateResponses?: boolean;
  pageBackground?: PageBackgroundPreset;
  cardStyle?: CardStyle;
  /** Background of the form card itself (hex). Default white. */
  cardBackground?: string;
  /** Editor + public layout. Defaults to canvas for new forms. */
  layoutMode?: LayoutMode;
  /** Canvas artboard width in px (public + editor). */
  canvasWidth?: number;
}

export const DEFAULT_THEME: FormTheme = {
  accent: "#4f46e5",
  dir: "rtl",
  submitLabel: "Submit",
  thankYouTitle: "Thank you!",
  thankYouMessage: "Your response has been recorded.",
  allowMultipleEntries: false,
  addEntryLabel: "Add another response",
  allowDuplicateResponses: false,
  pageBackground: "slate",
  cardStyle: "elevated",
  cardBackground: "#ffffff",
  layoutMode: "stack",
  canvasWidth: 640,
};

export const CANVAS_GRID = 8;
export const CANVAS_SNAP_THRESHOLD = 6;
export const DEFAULT_FIELD_WIDTH = 280;
export const DEFAULT_CANVAS_WIDTH = 640;

export const PAGE_BACKGROUNDS: {
  id: PageBackgroundPreset;
  label: string;
  bodyClass: string;
  swatch: string;
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
    className: "rounded-3xl p-6 shadow-xl shadow-slate-900/5 ring-1 ring-black/5 sm:p-8",
  },
  {
    id: "bordered",
    label: "Bordered",
    className: "rounded-3xl p-6 ring-2 ring-slate-200 sm:p-8",
  },
  {
    id: "plain",
    label: "Plain",
    className: "rounded-2xl p-6 sm:p-8",
  },
];

/** Quick presets for the form card fill (the white box around fields). */
export const CARD_BACKGROUNDS: { id: string; label: string; color: string }[] = [
  { id: "white", label: "White", color: "#ffffff" },
  { id: "cream", label: "Cream", color: "#fffbeb" },
  { id: "mist", label: "Mist", color: "#f8fafc" },
  { id: "lavender", label: "Lavender", color: "#f5f3ff" },
  { id: "mint", label: "Mint", color: "#ecfdf5" },
  { id: "blush", label: "Blush", color: "#fff1f2" },
  { id: "sky", label: "Sky", color: "#eff6ff" },
  { id: "ink", label: "Ink", color: "#0f172a" },
];

export function resolvePageBackground(theme: FormTheme): {
  bodyClass: string;
  style?: Record<string, string>;
} {
  const id = theme.pageBackground ?? DEFAULT_THEME.pageBackground!;
  const preset = PAGE_BACKGROUNDS.find((p) => p.id === id) ?? PAGE_BACKGROUNDS[0]!;
  if (id === "brand") {
    const accent = theme.accent || DEFAULT_THEME.accent;
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
  const id = theme.cardStyle ?? DEFAULT_THEME.cardStyle!;
  return (CARD_STYLES.find((c) => c.id === id) ?? CARD_STYLES[0]!).className;
}

/** Class + inline style for the form card (supports custom cardBackground). */
export function resolveCardAppearance(theme: FormTheme): {
  className: string;
  style: Record<string, string>;
} {
  const bg = theme.cardBackground || DEFAULT_THEME.cardBackground || "#ffffff";
  return {
    className: resolveCardClass(theme),
    style: { backgroundColor: bg },
  };
}

/** Rough luminance check — dark card → light text helper for chrome. */
export function isDarkCardBackground(theme: FormTheme): boolean {
  const hex = (theme.cardBackground || "#ffffff").replace("#", "");
  if (hex.length !== 6) return false;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 140;
}

// Metadata registry — one entry per field type. Rendering lives in the React
// components; this holds only the data both server and client agree on.
export interface FieldTypeMeta {
  type: FieldType;
  label: string; // human label in the builder palette
  icon: string; // single-glyph icon for the palette chip
  hasOptions: boolean;
  hasPlaceholder: boolean;
  hasMinMax: boolean;
  /** Disabled in palette / rendered as coming-soon (e.g. file upload). */
  comingSoon?: boolean;
  /** Fresh config for a newly-added field of this type. `id` is filled by caller. */
  defaults: () => Omit<FieldConfig, "id" | "type">;
}

export const FIELD_TYPES: Record<FieldType, FieldTypeMeta> = {
  text: {
    type: "text",
    label: "Short text",
    icon: "Type",
    hasOptions: false,
    hasPlaceholder: true,
    hasMinMax: true,
    defaults: () => ({ label: "Short text", placeholder: "", required: false }),
  },
  textarea: {
    type: "textarea",
    label: "Paragraph",
    icon: "AlignLeft",
    hasOptions: false,
    hasPlaceholder: true,
    hasMinMax: true,
    defaults: () => ({ label: "Paragraph", placeholder: "", required: false }),
  },
  phone: {
    type: "phone",
    label: "Phone",
    icon: "Phone",
    hasOptions: false,
    hasPlaceholder: true,
    hasMinMax: false,
    defaults: () => ({
      label: "Phone",
      placeholder: "050-000-0000",
      required: true,
      dir: "ltr",
      unique: true,
    }),
  },
  email: {
    type: "email",
    label: "Email",
    icon: "AtSign",
    hasOptions: false,
    hasPlaceholder: true,
    hasMinMax: false,
    defaults: () => ({
      label: "Email",
      placeholder: "you@example.com",
      required: false,
      dir: "ltr",
    }),
  },
  url: {
    type: "url",
    label: "Website",
    icon: "Link",
    hasOptions: false,
    hasPlaceholder: true,
    hasMinMax: false,
    defaults: () => ({
      label: "Website",
      placeholder: "https://",
      required: false,
      dir: "ltr",
    }),
  },
  number: {
    type: "number",
    label: "Number",
    icon: "Hash",
    hasOptions: false,
    hasPlaceholder: true,
    hasMinMax: true,
    defaults: () => ({ label: "Number", placeholder: "", required: false }),
  },
  select: {
    type: "select",
    label: "Dropdown",
    icon: "ChevronDownSquare",
    hasOptions: true,
    hasPlaceholder: true,
    hasMinMax: false,
    defaults: () => ({
      label: "Dropdown",
      placeholder: "Choose an option",
      required: false,
      options: ["Option 1", "Option 2"],
    }),
  },
  radio: {
    type: "radio",
    label: "Single choice",
    icon: "CircleDot",
    hasOptions: true,
    hasPlaceholder: false,
    hasMinMax: false,
    defaults: () => ({
      label: "Single choice",
      required: false,
      options: ["Option 1", "Option 2"],
    }),
  },
  checkbox: {
    type: "checkbox",
    label: "Checkboxes",
    icon: "CheckSquare",
    hasOptions: true,
    hasPlaceholder: false,
    hasMinMax: false,
    defaults: () => ({
      label: "Checkboxes",
      required: false,
      options: ["Option 1", "Option 2"],
    }),
  },
  date: {
    type: "date",
    label: "Date",
    icon: "Calendar",
    hasOptions: false,
    hasPlaceholder: false,
    hasMinMax: false,
    defaults: () => ({ label: "Date", required: false, dir: "ltr" }),
  },
  time: {
    type: "time",
    label: "Time",
    icon: "Clock",
    hasOptions: false,
    hasPlaceholder: false,
    hasMinMax: false,
    defaults: () => ({ label: "Time", required: false, dir: "ltr" }),
  },
  file: {
    type: "file",
    label: "File upload",
    icon: "Paperclip",
    hasOptions: false,
    hasPlaceholder: false,
    hasMinMax: false,
    defaults: () => ({
      label: "File upload",
      required: false,
      helpText: "Images, PDF, or documents up to 10 MB",
    }),
  },
  image: {
    type: "image",
    label: "Image",
    icon: "Image",
    hasOptions: false,
    hasPlaceholder: false,
    hasMinMax: false,
    defaults: () => ({
      label: "Image",
      required: false,
      src: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=640&q=80",
      layout: { x: 40, y: 40, w: 240, h: 160, z: 1 },
    }),
  },
  heading: {
    type: "heading",
    label: "Heading",
    icon: "Heading",
    hasOptions: false,
    hasPlaceholder: false,
    hasMinMax: false,
    defaults: () => ({
      label: "Section title",
      required: false,
      style: { labelColor: "#0f172a", labelSize: 28 },
      layout: { x: 40, y: 40, w: 360, h: 48, z: 1 },
    }),
  },
};

export const FIELD_TYPE_LIST: FieldTypeMeta[] = Object.values(FIELD_TYPES);

/** Is a value "empty" for the purpose of required-field validation? */
export function isEmptyValue(v: unknown): boolean {
  if (v == null) return true;
  if (Array.isArray(v)) return v.length === 0;
  return String(v).trim() === "";
}

/** Returns the ids of required fields that are missing in `data`. */
export function missingRequired(fields: FieldConfig[], data: Record<string, unknown>): string[] {
  return fields
    .filter((f) => !isDecorativeField(f.type) && f.required && isEmptyValue(data[f.id]))
    .map((f) => f.id);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[^\s]*)?$/i;

export type FieldError = { id: string; message: string };

/** Client + server friendly field validation beyond required. */
export function validateFields(
  fields: FieldConfig[],
  data: Record<string, unknown>,
): FieldError[] {
  const errors: FieldError[] = [];

  for (const f of fields) {
    if (isDecorativeField(f.type)) continue;
    const raw = data[f.id];
    const empty = isEmptyValue(raw);

    if (f.required && empty) {
      errors.push({ id: f.id, message: "This field is required" });
      continue;
    }
    if (empty) continue;

    const str = Array.isArray(raw) ? "" : String(raw).trim();

    if (f.type === "email" && !EMAIL_RE.test(str)) {
      errors.push({ id: f.id, message: "Enter a valid email address" });
    }
    if (f.type === "url" && !URL_RE.test(str)) {
      errors.push({ id: f.id, message: "Enter a valid website URL" });
    }
    if (f.type === "phone" && str.replace(/\D/g, "").length < 7) {
      errors.push({ id: f.id, message: "Enter a valid phone number" });
    }
    if (f.type === "number") {
      const n = Number(str);
      if (Number.isNaN(n)) {
        errors.push({ id: f.id, message: "Enter a valid number" });
      } else {
        if (f.min != null && n < f.min) {
          errors.push({ id: f.id, message: `Must be at least ${f.min}` });
        }
        if (f.max != null && n > f.max) {
          errors.push({ id: f.id, message: `Must be at most ${f.max}` });
        }
      }
    }
    if ((f.type === "text" || f.type === "textarea") && !Array.isArray(raw)) {
      if (f.min != null && str.length < f.min) {
        errors.push({ id: f.id, message: `At least ${f.min} characters` });
      }
      if (f.max != null && str.length > f.max) {
        errors.push({ id: f.id, message: `At most ${f.max} characters` });
      }
    }
  }

  return errors;
}

/** Heuristic: does this field hold a phone number? Used by duplicate detection. */
export function isPhoneField(f: FieldConfig): boolean {
  return f.type === "phone" || /phone|טלפון|נייד|mobile/i.test(f.label);
}

/** Heuristic: does this field hold a person's name? Used by duplicate detection. */
export function isNameField(f: FieldConfig): boolean {
  return /name|שם/i.test(f.label);
}

/**
 * Fields that must be unique across submissions.
 * Explicit `unique: true/false` wins. Legacy: unmarked phone fields stay unique
 * unless the form theme allows duplicates.
 */
export function fieldsRequiringUnique(
  fields: FieldConfig[],
  allowDuplicateResponses?: boolean,
): FieldConfig[] {
  if (allowDuplicateResponses) return [];
  return fields.filter((f) => {
    if (isDecorativeField(f.type) || f.type === "checkbox") return false;
    if (f.unique === true) return true;
    if (f.unique === false) return false;
    // Legacy default for older forms without the unique flag.
    return isPhoneField(f);
  });
}

/** True when the form should render with absolute canvas positions. */
export function usesCanvasLayout(theme: FormTheme, fields: FieldConfig[]): boolean {
  if (theme.layoutMode === "stack") return false;
  if (theme.layoutMode === "canvas") return true;
  return fields.some((f) => f.layout != null);
}

/** Auto-place fields that lack layout into a stacked canvas column. */
export function ensureCanvasLayouts(fields: FieldConfig[] | null | undefined): FieldConfig[] {
  const list = Array.isArray(fields) ? fields : [];
  let y = 24;
  let z = 1;
  const x = 40;
  const w = DEFAULT_FIELD_WIDTH;
  return list.map((f) => {
    if (f.layout) {
      z = Math.max(z, f.layout.z + 1);
      return f;
    }
    const h =
      f.type === "textarea"
        ? 120
        : f.type === "radio" || f.type === "checkbox"
          ? 88
          : f.type === "file"
            ? 96
            : f.type === "image"
              ? 160
              : f.type === "heading"
                ? 48
                : 72;
    const layout: FieldLayout = { x, y, w: f.type === "heading" ? 360 : w, h, z: z++ };
    y += h + 16;
    return { ...f, layout };
  });
}
