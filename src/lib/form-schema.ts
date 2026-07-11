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
  | "file";

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
  /** When true, skip the phone-number duplicate guard on submit. */
  allowDuplicateResponses?: boolean;
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
  allowDuplicateResponses: false,
  pageBackground: "slate",
  cardStyle: "elevated",
};

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
    className:
      "rounded-3xl bg-white p-6 shadow-xl shadow-slate-900/5 ring-1 ring-slate-100 sm:p-8",
  },
  {
    id: "bordered",
    label: "Bordered",
    className: "rounded-3xl bg-white p-6 ring-2 ring-slate-200 sm:p-8",
  },
  {
    id: "plain",
    label: "Plain",
    className: "rounded-2xl bg-white/90 p-6 sm:p-8",
  },
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
    comingSoon: true,
    defaults: () => ({
      label: "File upload",
      required: false,
      helpText: "File uploads coming soon",
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
    .filter((f) => f.type !== "file" && f.required && isEmptyValue(data[f.id]))
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
    if (f.type === "file") continue;
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
