import {
  adminItems,
  FORM_VERSIONS_COLLECTION,
  MAX_FORM_VERSIONS,
} from "./wix-admin";
import {
  DEFAULT_THEME,
  type FieldConfig,
  type FormTheme,
} from "./form-schema";

/** Published snapshot served on /f/:slug (draft can diverge until next Publish). */
export interface LiveSnapshot {
  title: string;
  description: string;
  fields: FieldConfig[];
  theme: FormTheme;
  publishedAt: string;
  version: number;
}

export interface FormVersion {
  id: string;
  formId: string;
  version: number;
  title: string;
  description: string;
  fields: FieldConfig[];
  theme: FormTheme;
  createdDate: string;
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

function toRecord(raw: unknown): Record<string, unknown> {
  const r = (raw ?? {}) as Record<string, unknown>;
  const container = (r.dataItem ?? r.item ?? r) as Record<string, unknown>;
  if (!container) return {};
  const nested = container.data;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const n = nested as Record<string, unknown>;
    if (n.formId != null || n.version != null || n.fields != null) {
      return { ...n, _id: n._id ?? n.id ?? container._id ?? container.id };
    }
  }
  return { ...container, _id: container._id ?? container.id };
}

function mapVersion(raw: Record<string, unknown>): FormVersion {
  const r = toRecord(raw);
  return {
    id: String(r._id ?? r.id ?? ""),
    formId: String(r.formId ?? ""),
    version: Number(r.version ?? 0),
    title: String(r.title ?? ""),
    description: String(r.description ?? ""),
    fields: parseJson<FieldConfig[]>(r.fields, []),
    theme: parseJson<FormTheme>(r.theme, DEFAULT_THEME),
    createdDate:
      r._createdDate instanceof Date
        ? r._createdDate.toISOString()
        : String(r._createdDate ?? r.createdDate ?? ""),
  };
}

export async function listFormVersions(formId: string): Promise<FormVersion[]> {
  try {
    const res = await adminItems
      .query(FORM_VERSIONS_COLLECTION)
      .eq("formId", formId)
      .limit(50)
      .find();
    return res.items
      .map((i: Record<string, unknown>) => mapVersion(i))
      .sort((a, b) => b.version - a.version || (a.createdDate < b.createdDate ? 1 : -1));
  } catch {
    return [];
  }
}

export async function getFormVersion(id: string): Promise<FormVersion | null> {
  try {
    const res = await adminItems.get(FORM_VERSIONS_COLLECTION, id);
    const rec = toRecord(res);
    return rec._id || rec.id ? mapVersion(rec) : null;
  } catch {
    return null;
  }
}

/** Insert a publish snapshot and prune to MAX_FORM_VERSIONS. Returns the new version number. */
export async function insertFormVersion(
  formId: string,
  snapshot: Omit<LiveSnapshot, "publishedAt" | "version"> & { version?: number },
): Promise<{ version: number; id: string }> {
  const existing = await listFormVersions(formId);
  const nextVersion =
    snapshot.version ??
    (existing.length ? Math.max(...existing.map((v) => v.version)) + 1 : 1);

  const dataItem = {
    formId,
    version: nextVersion,
    title: snapshot.title,
    description: snapshot.description,
    fields: JSON.stringify(snapshot.fields),
    theme: JSON.stringify(snapshot.theme),
    createdDate: new Date().toISOString(),
  };
  const res = await adminItems.insert(FORM_VERSIONS_COLLECTION, dataItem);
  const created = mapVersion({ ...dataItem, ...toRecord(res) });

  // Prune oldest beyond cap
  const all = await listFormVersions(formId);
  if (all.length > MAX_FORM_VERSIONS) {
    const drop = all.slice(MAX_FORM_VERSIONS);
    for (const v of drop) {
      if (v.id) {
        try {
          await adminItems.remove(FORM_VERSIONS_COLLECTION, v.id);
        } catch {
          /* best-effort */
        }
      }
    }
  }

  return { version: nextVersion, id: created.id };
}

export function versionToLive(v: FormVersion): LiveSnapshot {
  return {
    title: v.title,
    description: v.description,
    fields: v.fields,
    theme: v.theme,
    publishedAt: v.createdDate || new Date().toISOString(),
    version: v.version,
  };
}
