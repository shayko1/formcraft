import { adminItems, FORMS_COLLECTION } from "./wix-admin";
import { DEFAULT_THEME, type FieldConfig, type FormTheme } from "./form-schema";

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
  theme: FormTheme;
  published: boolean;
  submissionCount: number;
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

// Unwrap a data record from any @wix/data response shape:
// insert → { dataItem: { data: {...} } } | { dataItem: {...} } | { item: {...} } | flat,
// query items → flat { _id, ...} | nested { data: {...} }.
function toRecord(raw: unknown): Record<string, unknown> {
  const r = (raw ?? {}) as Record<string, unknown>;
  const container = (r.dataItem ?? r.item ?? r) as Record<string, unknown>;
  const record = (container?.data ?? container) as Record<string, unknown>;
  return record ?? {};
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
    theme: parseJson<FormTheme>(r.theme, DEFAULT_THEME),
    published: Boolean(r.published),
    submissionCount: Number(r.submissionCount ?? 0),
    createdDate:
      r._createdDate instanceof Date
        ? r._createdDate.toISOString()
        : String(r._createdDate ?? ""),
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
    theme: JSON.stringify(input.theme ?? DEFAULT_THEME),
    published: false,
    submissionCount: 0,
  };
  const res = await adminItems.insert(FORMS_COLLECTION, dataItem);
  // Merge the server record (has _id + timestamps) over the input so the id is
  // always present regardless of the SDK's response wrapper shape.
  return mapForm({ ...dataItem, ...toRecord(res) });
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

export type FormPatch = Partial<{
  title: string;
  description: string;
  fields: FieldConfig[];
  theme: FormTheme;
  published: boolean;
  submissionCount: number;
}>;

export async function updateForm(id: string, patch: FormPatch): Promise<void> {
  // items.update is a full-document REPLACE — sending only changed fields would wipe
  // the rest (published, slug, ownerId, …). So read-modify-write: load the current
  // record, apply the patch, and write the complete object back.
  const existing = await getFormById(id);
  if (!existing) throw new Error("Form not found");
  const full = {
    _id: id,
    ownerId: existing.ownerId,
    title: patch.title ?? existing.title,
    description: patch.description ?? existing.description,
    slug: existing.slug,
    templateId: existing.templateId,
    fields: JSON.stringify(patch.fields ?? existing.fields),
    theme: JSON.stringify(patch.theme ?? existing.theme),
    published: patch.published ?? existing.published,
    submissionCount: patch.submissionCount ?? existing.submissionCount,
  };
  await adminItems.update(FORMS_COLLECTION, full);
}

export async function deleteForm(id: string): Promise<void> {
  await adminItems.remove(FORMS_COLLECTION, id);
}
