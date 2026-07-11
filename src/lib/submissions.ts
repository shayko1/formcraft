import { adminItems, SUBMISSIONS_COLLECTION } from "./wix-admin";

export interface Submission {
  id: string;
  formId: string;
  ownerId: string;
  data: Record<string, unknown>;
  exported: boolean;
  createdDate: string;
}

function parseData(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === "object") return raw as Record<string, unknown>;
  try {
    return JSON.parse(String(raw));
  } catch {
    return {};
  }
}

// Unwrap { dataItem } / { item } wrappers. Submissions also have a field named `data`
// (answers blob), so only descend into `.data` when it looks like the CMS record
// (has formId) — not when it is the answers object/string.
function toRecord(raw: unknown): Record<string, unknown> {
  const r = (raw ?? {}) as Record<string, unknown>;
  const container = (r.dataItem ?? r.item ?? r) as Record<string, unknown>;
  if (!container) return {};

  const nested = container.data;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const n = nested as Record<string, unknown>;
    // items.get often returns { id, data: { formId, data, exported, ... } }
    if (n.formId != null) {
      return {
        ...n,
        _id: n._id ?? n.id ?? container._id ?? container.id,
      };
    }
  }

  return container;
}

function mapSubmission(raw: Record<string, unknown>): Submission {
  const r = toRecord(raw);
  return {
    id: String(r._id ?? r.id ?? ""),
    formId: String(r.formId ?? ""),
    ownerId: String(r.ownerId ?? ""),
    data: parseData(r.data),
    exported: Boolean(r.exported),
    createdDate:
      r._createdDate instanceof Date
        ? r._createdDate.toISOString()
        : String(r._createdDate ?? ""),
  };
}

export async function insertSubmission(
  formId: string,
  ownerId: string,
  data: Record<string, unknown>,
): Promise<void> {
  await adminItems.insert(SUBMISSIONS_COLLECTION, {
    formId,
    ownerId,
    data: JSON.stringify(data),
    exported: false,
  });
}

export async function listSubmissions(formId: string): Promise<Submission[]> {
  const res = await adminItems.query(SUBMISSIONS_COLLECTION)
    .eq("formId", formId)
    .limit(1000)
    .find();
  return res.items
    .map((i: Record<string, unknown>) => mapSubmission(i))
    .sort((a: Submission, b: Submission) => (a.createdDate < b.createdDate ? 1 : -1));
}

/** Count submissions an owner received since the first of the current month (UTC). */
export async function countSubmissionsThisMonth(ownerId: string): Promise<number> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const res = await adminItems.query(SUBMISSIONS_COLLECTION)
    .eq("ownerId", ownerId)
    .ge("_createdDate", monthStart)
    .limit(1000)
    .find();
  return res.items.length;
}

/** Fast duplicate guard: does a submission with this exact value already exist? */
export async function existsWithValue(
  formId: string,
  fieldId: string,
  value: string,
): Promise<boolean> {
  const rows = await listSubmissions(formId);
  const norm = value.replace(/\s/g, "").toLowerCase();
  return rows.some((r) => String(r.data[fieldId] ?? "").replace(/\s/g, "").toLowerCase() === norm);
}

// Mark rows exported. items.update is a full replace, so rebuild each complete record
// (data already in hand from the export flow) with exported=true — no lossy partial write.
export async function markExported(subs: Submission[]): Promise<void> {
  await Promise.all(
    subs.map((s) =>
      adminItems.update(SUBMISSIONS_COLLECTION, {
        _id: s.id,
        formId: s.formId,
        ownerId: s.ownerId,
        data: JSON.stringify(s.data),
        exported: true,
      }),
    ),
  );
}

/** Merge admin-only keys into submission.data (full replace). Returns updated submission. */
export async function updateInternalData(
  sub: Submission,
  patch: Record<string, unknown>,
): Promise<Submission> {
  const data = { ...sub.data, ...patch };
  await adminItems.update(SUBMISSIONS_COLLECTION, {
    _id: sub.id,
    formId: sub.formId,
    ownerId: sub.ownerId,
    data: JSON.stringify(data),
    exported: sub.exported,
  });
  return { ...sub, data };
}

export async function getSubmissionById(id: string): Promise<Submission | null> {
  try {
    const res = await adminItems.get(SUBMISSIONS_COLLECTION, id);
    const mapped = mapSubmission(res as Record<string, unknown>);
    if (mapped.id && mapped.formId) return mapped;
  } catch {
    /* fall through to query */
  }
  // items.get() can return a nested wrapper that omits formId; query matches list view shape.
  try {
    const res = await adminItems
      .query(SUBMISSIONS_COLLECTION)
      .eq("_id", id)
      .limit(1)
      .find();
    const first = res.items[0] as Record<string, unknown> | undefined;
    if (!first) return null;
    const mapped = mapSubmission(first);
    return mapped.id ? mapped : null;
  } catch {
    return null;
  }
}

export async function deleteSubmissions(ids: string[]): Promise<void> {
  await adminItems.bulkRemove(SUBMISSIONS_COLLECTION, ids);
}
