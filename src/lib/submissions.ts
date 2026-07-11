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

function mapSubmission(raw: Record<string, unknown>): Submission {
  return {
    id: String(raw._id ?? ""),
    formId: String(raw.formId ?? ""),
    ownerId: String(raw.ownerId ?? ""),
    data: parseData(raw.data),
    exported: Boolean(raw.exported),
    createdDate:
      raw._createdDate instanceof Date
        ? raw._createdDate.toISOString()
        : String(raw._createdDate ?? ""),
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

export async function markExported(ids: string[]): Promise<void> {
  await adminItems.bulkPatch(
    SUBMISSIONS_COLLECTION,
    ids.map((id) => ({ _id: id, exported: true })),
  );
}

export async function deleteSubmissions(ids: string[]): Promise<void> {
  await adminItems.bulkRemove(SUBMISSIONS_COLLECTION, ids);
}
