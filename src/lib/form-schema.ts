// Shared, framework-agnostic form schema. Imported by both Astro (server) and
// React islands, so it must stay pure — no JSX, no React, no Wix SDK here.

export type FieldType =
  | "text"
  | "textarea"
  | "phone"
  | "email"
  | "number"
  | "select"
  | "radio"
  | "checkbox"
  | "date";

export interface FieldConfig {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[]; // select | radio | checkbox
  dir?: "rtl" | "ltr" | "auto";
}

export interface FormTheme {
  accent: string; // hex color, drives buttons + focus rings
  dir: "rtl" | "ltr";
}

export const DEFAULT_THEME: FormTheme = { accent: "#4f46e5", dir: "rtl" };

// Metadata registry — one entry per field type. Rendering lives in the React
// components; this holds only the data both server and client agree on.
export interface FieldTypeMeta {
  type: FieldType;
  label: string;      // human label in the builder palette
  icon: string;       // single-glyph icon for the palette chip
  hasOptions: boolean;
  hasPlaceholder: boolean;
  /** Fresh config for a newly-added field of this type. `id` is filled by caller. */
  defaults: () => Omit<FieldConfig, "id" | "type">;
}

export const FIELD_TYPES: Record<FieldType, FieldTypeMeta> = {
  text: {
    type: "text", label: "Short text", icon: "T", hasOptions: false, hasPlaceholder: true,
    defaults: () => ({ label: "Short text", placeholder: "", required: false }),
  },
  textarea: {
    type: "textarea", label: "Paragraph", icon: "¶", hasOptions: false, hasPlaceholder: true,
    defaults: () => ({ label: "Paragraph", placeholder: "", required: false }),
  },
  phone: {
    type: "phone", label: "Phone", icon: "☎", hasOptions: false, hasPlaceholder: true,
    defaults: () => ({ label: "Phone", placeholder: "", required: true, dir: "ltr" }),
  },
  email: {
    type: "email", label: "Email", icon: "@", hasOptions: false, hasPlaceholder: true,
    defaults: () => ({ label: "Email", placeholder: "", required: false, dir: "ltr" }),
  },
  number: {
    type: "number", label: "Number", icon: "#", hasOptions: false, hasPlaceholder: true,
    defaults: () => ({ label: "Number", placeholder: "", required: false }),
  },
  select: {
    type: "select", label: "Dropdown", icon: "▾", hasOptions: true, hasPlaceholder: false,
    defaults: () => ({ label: "Dropdown", required: false, options: ["Option 1", "Option 2"] }),
  },
  radio: {
    type: "radio", label: "Single choice", icon: "◉", hasOptions: true, hasPlaceholder: false,
    defaults: () => ({ label: "Single choice", required: false, options: ["Option 1", "Option 2"] }),
  },
  checkbox: {
    type: "checkbox", label: "Checkboxes", icon: "☑", hasOptions: true, hasPlaceholder: false,
    defaults: () => ({ label: "Checkboxes", required: false, options: ["Option 1", "Option 2"] }),
  },
  date: {
    type: "date", label: "Date", icon: "📅", hasOptions: false, hasPlaceholder: false,
    defaults: () => ({ label: "Date", required: false, dir: "ltr" }),
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
  return fields.filter((f) => f.required && isEmptyValue(data[f.id])).map((f) => f.id);
}

/** Heuristic: does this field hold a phone number? Used by duplicate detection. */
export function isPhoneField(f: FieldConfig): boolean {
  return f.type === "phone" || /phone|טלפון|נייד|mobile/i.test(f.label);
}

/** Heuristic: does this field hold a person's name? Used by duplicate detection. */
export function isNameField(f: FieldConfig): boolean {
  return /name|שם/i.test(f.label);
}
