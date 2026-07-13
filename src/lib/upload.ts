/** Shared helpers for form file-upload fields (Wix Media Manager). */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB (use resumable API above this)

const ALLOWED_MIME_PREFIXES = [
  "image/",
  "application/pdf",
  "text/",
  "application/msword",
  "application/vnd.openxmlformats",
  "application/vnd.ms-",
  "application/zip",
  "application/x-zip",
];

export interface UploadedFileValue {
  name: string;
  url: string;
  id?: string;
}

export function isAllowedMime(mime: string): boolean {
  const m = (mime || "").toLowerCase();
  if (!m) return true; // browsers sometimes omit — Wix still accepts via extension
  return ALLOWED_MIME_PREFIXES.some((p) => m.startsWith(p) || m === p);
}

export function isAllowedImageMime(mime: string): boolean {
  const m = (mime || "").toLowerCase();
  if (!m) return true;
  return m.startsWith("image/");
}

export function validateUploadFile(file: File, imagesOnly = false): string | null {
  if (file.size <= 0) return "Empty file.";
  if (file.size > MAX_UPLOAD_BYTES) return "File must be 10 MB or smaller.";
  if (imagesOnly) {
    if (!isAllowedImageMime(file.type)) return "Only image files are allowed (JPG, PNG, WebP, GIF…).";
  } else if (!isAllowedMime(file.type)) {
    return "Unsupported file type. Use an image, PDF, or document.";
  }
  return null;
}

export function serializeUploadedFile(v: UploadedFileValue): string {
  return JSON.stringify(v);
}

export function parseUploadedFile(raw: unknown): UploadedFileValue | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const url = String(o.url ?? "");
    if (!url) return null;
    return { name: String(o.name ?? "file"), url, id: o.id ? String(o.id) : undefined };
  }
  const s = String(raw).trim();
  if (!s) return null;
  if (s.startsWith("{")) {
    try {
      return parseUploadedFile(JSON.parse(s));
    } catch {
      return null;
    }
  }
  // Plain URL fallback
  if (/^https?:\/\//i.test(s)) return { name: "file", url: s };
  return null;
}

/** Human-readable label for tables / CSV. */
export function uploadedFileLabel(raw: unknown): string {
  const f = parseUploadedFile(raw);
  if (!f) return raw == null ? "" : String(raw);
  return f.name || f.url;
}

/** Browser helper: mint upload URL then PUT the file to Wix Media. */
export async function uploadToWixMedia(
  formId: string,
  file: File,
  opts?: { imagesOnly?: boolean },
): Promise<UploadedFileValue> {
  const invalid = validateUploadFile(file, opts?.imagesOnly);
  if (invalid) throw new Error(invalid);

  const mint = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      formId,
      mimeType: file.type || (opts?.imagesOnly ? "image/jpeg" : "application/octet-stream"),
      fileName: file.name,
      size: file.size,
      imagesOnly: !!opts?.imagesOnly,
    }),
  });
  const mintBody = (await mint.json().catch(() => ({}))) as {
    uploadUrl?: string;
    message?: string;
  };
  if (!mint.ok || !mintBody.uploadUrl) {
    throw new Error(mintBody.message || "Could not start upload.");
  }

  const put = await fetch(mintBody.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!put.ok) {
    throw new Error("Upload failed. Please try again.");
  }
  const putBody = (await put.json().catch(() => ({}))) as {
    file?: { id?: string; url?: string; displayName?: string };
    files?: Array<{ id?: string; url?: string; displayName?: string }>;
  };
  const descriptor = putBody.file ?? putBody.files?.[0];
  const url = descriptor?.url;
  if (!url) {
    throw new Error("Upload finished but no file URL was returned.");
  }
  return {
    name: descriptor?.displayName || file.name,
    url,
    id: descriptor?.id,
  };
}
