import { adminItems, FORMS_COLLECTION } from "./wix-admin";
import {
  DEFAULT_THEME,
  type FieldConfig,
  type FormTheme,
  type InternalFieldConfig,
} from "./form-schema";
import { insertFormVersion, type LiveSnapshot } from "./form-versions";

export type { LiveSnapshot };

// Short URL-safe random suffix. Inline (no nanoid) — nanoid's cjs entry does a
// top-level `require('crypto')` that crashes the Cloudflare Worker runtime Wix uses.
const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
function nano(len = 6): string {
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

export interface Form {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  slug: string;
  templateId: string;
  fields: FieldConfig[];
  /** Admin-only response columns; missing on old forms → []. */
  internalFields: InternalFieldConfig[];
  theme: FormTheme;
  published: boolean;
  /** Last published content; null if never published (or legacy without live). */
  live: LiveSnapshot | null;
  submissionCount: number;
  viewCount: number;
  startCount: number;
  createdDate: string;
}

interface FormInput {
  ownerId: string;
  title: string;
  description?: string;
  templateId: string;
  fields: FieldConfig[];
  theme?: FormTheme;
}

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^\w֐-׿\s-]/g, "") // keep word chars, Hebrew, spaces, hyphens
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40)
    .replace(/^-|-$/g, "");
  return `${base || "form"}-${nano()}`;
}

function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw === "object") return raw as T;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}

function parseLive(raw: unknown): LiveSnapshot | null {
  if (raw == null || raw === "") return null;
  const parsed = parseJson<LiveSnapshot | null>(raw, null);
  if (!parsed || typeof parsed !== "object") return null;
  if (!Array.isArray(parsed.fields)) return null;
  return {
    title: String(parsed.title ?? ""),
    description: String(parsed.description ?? ""),
    fields: parsed.fields,
    theme: { ...DEFAULT_THEME, ...(parsed.theme ?? {}) },
    publishedAt: String(parsed.publishedAt ?? ""),
    version: Number(parsed.version ?? 0),
  };
}

// Unwrap a data record from any @wix/data response shape:
// insert → { dataItem: { _id, data: {...} } } | { dataItem: {...} } | { item: {...} } | flat,
// query items → flat { _id, ...} | nested { data: {...} }.
// Critical: `_id` often lives on the container while fields live in `.data` —
// descending into `.data` alone drops the id and breaks create → redirect.
function toRecord(raw: unknown): Record<string, unknown> {
  const r = (raw ?? {}) as Record<string, unknown>;
  const container = (r.dataItem ?? r.item ?? r) as Record<string, unknown>;
  if (!container) return {};

  const nested = container.data;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const n = nested as Record<string, unknown>;
    // CMS payload (has form fields) vs unrelated nested objects
    if (n.ownerId != null || n.title != null || n.slug != null || n.fields != null) {
      return {
        ...n,
        _id: n._id ?? n.id ?? container._id ?? container.id,
      };
    }
  }

  return {
    ...container,
    _id: container._id ?? container.id,
  };
}

function mapForm(raw: Record<string, unknown>): Form {
  const r = toRecord(raw);
  return {
    id: String(r._id ?? r.id ?? ""),
    ownerId: String(r.ownerId ?? ""),
    title: String(r.title ?? ""),
    description: String(r.description ?? ""),
    slug: String(r.slug ?? ""),
    templateId: String(r.templateId ?? "custom"),
    fields: parseJson<FieldConfig[]>(r.fields, []),
    internalFields: parseJson<InternalFieldConfig[]>(r.internalFields, []),
    theme: parseJson<FormTheme>(r.theme, DEFAULT_THEME),
    published: Boolean(r.published),
    live: parseLive(r.live),
    submissionCount: Number(r.submissionCount ?? 0),
    viewCount: Number(r.viewCount ?? 0),
    startCount: Number(r.startCount ?? 0),
    createdDate:
      r._createdDate instanceof Date
        ? r._createdDate.toISOString()
        : String(r._createdDate ?? ""),
  };
}

function formToCmsPayload(form: Form, overrides: Partial<{
  title: string;
  description: string;
  fields: FieldConfig[];
  internalFields: InternalFieldConfig[];
  theme: FormTheme;
  published: boolean;
  live: LiveSnapshot | null;
  submissionCount: number;
  viewCount: number;
  startCount: number;
}> = {}) {
  const live = overrides.live !== undefined ? overrides.live : form.live;
  return {
    _id: form.id,
    ownerId: form.ownerId,
    title: overrides.title ?? form.title,
    description: overrides.description ?? form.description,
    slug: form.slug,
    templateId: form.templateId,
    fields: JSON.stringify(overrides.fields ?? form.fields),
    internalFields: JSON.stringify(overrides.internalFields ?? form.internalFields),
    theme: JSON.stringify(overrides.theme ?? form.theme),
    published: overrides.published ?? form.published,
    live: live ? JSON.stringify(live) : "",
    submissionCount: overrides.submissionCount ?? form.submissionCount,
    viewCount: overrides.viewCount ?? form.viewCount,
    startCount: overrides.startCount ?? form.startCount,
  };
}

export async function createForm(input: FormInput): Promise<Form> {
  const dataItem = {
    ownerId: input.ownerId,
    title: input.title,
    description: input.description ?? "",
    slug: slugify(input.title),
    templateId: input.templateId,
    fields: JSON.stringify(input.fields),
    internalFields: JSON.stringify([]),
    theme: JSON.stringify(input.theme ?? DEFAULT_THEME),
    published: false,
    live: "",
    submissionCount: 0,
    viewCount: 0,
    startCount: 0,
  };
  const res = await adminItems.insert(FORMS_COLLECTION, dataItem);
  // Merge the server record (has _id + timestamps) over the input so the id is
  // always present regardless of the SDK's response wrapper shape.
  const created = mapForm({ ...dataItem, ...toRecord(res) });
  if (!created.id) {
    // Last-resort: some SDK builds nest id only on the outer wrapper.
    const outer = (res ?? {}) as Record<string, unknown>;
    const wrap = (outer.dataItem ?? outer.item ?? outer) as Record<string, unknown>;
    const fallbackId = String(wrap?._id ?? wrap?.id ?? outer._id ?? outer.id ?? "");
    if (fallbackId) return { ...created, id: fallbackId };
  }
  return created;
}

export async function getFormById(id: string): Promise<Form | null> {
  try {
    const res = await adminItems.get(FORMS_COLLECTION, id);
    const rec = toRecord(res);
    return rec._id || rec.id ? mapForm(rec) : null;
  } catch {
    return null;
  }
}

export async function getFormBySlug(slug: string): Promise<Form | null> {
  try {
    const res = await adminItems.query(FORMS_COLLECTION).eq("slug", slug).limit(1).find();
    const first = res.items[0];
    return first ? mapForm(first as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function listFormsByOwner(ownerId: string): Promise<Form[]> {
  const res = await adminItems.query(FORMS_COLLECTION)
    .eq("ownerId", ownerId)
    .limit(100)
    .find();
  return res.items
    .map((i: Record<string, unknown>) => mapForm(i))
    .sort((a: Form, b: Form) => (a.createdDate < b.createdDate ? 1 : -1));
}

export async function countPublishedByOwner(ownerId: string): Promise<number> {
  const res = await adminItems.query(FORMS_COLLECTION)
    .eq("ownerId", ownerId)
    .eq("published", true)
    .limit(100)
    .find();
  return res.items.length;
}

/** Total forms owned (drafts + published) — drives the free-tier creation cap. */
export async function countFormsByOwner(ownerId: string): Promise<number> {
  const res = await adminItems.query(FORMS_COLLECTION)
    .eq("ownerId", ownerId)
    .limit(1000)
    .find();
  return res.items.length;
}

/**
 * Content served to respondents. Prefers `live`; for legacy published forms
 * without a live blob, falls back to draft fields.
 */
export function getPublicFormContent(form: Form): {
  title: string;
  description: string;
  fields: FieldConfig[];
  theme: FormTheme;
} {
  if (form.live) {
    return {
      title: form.live.title,
      description: form.live.description,
      fields: form.live.fields,
      theme: { ...DEFAULT_THEME, ...form.live.theme },
    };
  }
  return {
    title: form.title,
    description: form.description,
    fields: form.fields,
    theme: form.theme,
  };
}

export type FormPatch = Partial<{
  title: string;
  description: string;
  fields: FieldConfig[];
  internalFields: InternalFieldConfig[];
  theme: FormTheme;
  published: boolean;
  live: LiveSnapshot | null;
  submissionCount: number;
  viewCount: number;
  startCount: number;
}>;

export async function updateForm(id: string, patch: FormPatch): Promise<void> {
  // items.update is a full-document REPLACE — sending only changed fields would wipe
  // the rest (published, slug, ownerId, live, …). So read-modify-write.
  const existing = await getFormById(id);
  if (!existing) throw new Error("Form not found");
  await adminItems.update(FORMS_COLLECTION, formToCmsPayload(existing, patch));
}

/** Copy current draft → live, mark published, insert version (max 10). */
export async function publishForm(id: string, draft?: {
  title?: string;
  description?: string;
  fields?: FieldConfig[];
  internalFields?: InternalFieldConfig[];
  theme?: FormTheme;
}): Promise<{ version: number; live: LiveSnapshot }> {
  const existing = await getFormById(id);
  if (!existing) throw new Error("Form not found");

  const title = draft?.title ?? existing.title;
  const description = draft?.description ?? existing.description;
  const fields = draft?.fields ?? existing.fields;
  const theme = draft?.theme ?? existing.theme;
  const internalFields = draft?.internalFields ?? existing.internalFields;

  const { version } = await insertFormVersion(id, {
    title,
    description,
    fields,
    theme,
  });

  const live: LiveSnapshot = {
    title,
    description,
    fields,
    theme,
    publishedAt: new Date().toISOString(),
    version,
  };

  await adminItems.update(
    FORMS_COLLECTION,
    formToCmsPayload(existing, {
      title,
      description,
      fields,
      internalFields,
      theme,
      published: true,
      live,
    }),
  );

  return { version, live };
}

export async function unpublishForm(id: string): Promise<void> {
  await updateForm(id, { published: false });
}

/** Replace draft content from a restored version (does not change live). */
export async function restoreDraftFromSnapshot(
  id: string,
  snapshot: {
    title: string;
    description: string;
    fields: FieldConfig[];
    theme: FormTheme;
  },
): Promise<void> {
  await updateForm(id, {
    title: snapshot.title,
    description: snapshot.description,
    fields: snapshot.fields,
    theme: snapshot.theme,
  });
}

export async function deleteForm(id: string): Promise<void> {
  await adminItems.remove(FORMS_COLLECTION, id);
}
