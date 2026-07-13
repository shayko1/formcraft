import type { APIRoute } from "astro";
import { getFormById } from "../../lib/forms";
import { getCurrentMemberId } from "../../lib/session";
import { generateUploadUrl } from "../../lib/wix-admin";
import { isAllowedImageMime, isAllowedMime, MAX_UPLOAD_BYTES } from "../../lib/upload";

/**
 * POST /api/upload
 * { formId, mimeType, fileName, size?, imagesOnly? } → { uploadUrl }
 *
 * Allowed when:
 * - form is published (public respondent uploads), OR
 * - caller is the form owner (builder image/asset uploads on drafts)
 */
export const POST: APIRoute = async ({ request }) => {
  let body: {
    formId?: string;
    mimeType?: string;
    fileName?: string;
    size?: number;
    imagesOnly?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return json(400, "Malformed request.");
  }

  const formId = body.formId?.trim();
  const imagesOnly = !!body.imagesOnly;
  const mimeType = (body.mimeType || (imagesOnly ? "image/jpeg" : "application/octet-stream")).trim();
  const fileName = sanitizeFileName(body.fileName || "upload.bin");
  const size = typeof body.size === "number" ? body.size : undefined;

  if (!formId) return json(400, "Missing formId.");
  if (imagesOnly ? !isAllowedImageMime(mimeType) : !isAllowedMime(mimeType)) {
    return json(
      400,
      imagesOnly
        ? "Only image files are allowed."
        : "Unsupported file type. Use an image, PDF, or document.",
    );
  }
  if (size != null && size > MAX_UPLOAD_BYTES) {
    return json(400, "File must be 10 MB or smaller.");
  }

  const form = await getFormById(formId);
  if (!form) return json(404, "This form does not exist.");

  const memberId = await getCurrentMemberId();
  const isOwner = !!memberId && memberId === form.ownerId;
  if (!form.published && !isOwner) {
    return json(403, "This form is not accepting uploads.");
  }

  try {
    const res = await generateUploadUrl(mimeType, {
      fileName,
      filePath: imagesOnly
        ? `/formcraft-images/${formId}`
        : `/formcraft-uploads/${formId}`,
      private: false,
    });
    const uploadUrl = res.uploadUrl;
    if (!uploadUrl) throw new Error("No uploadUrl returned");
    return new Response(JSON.stringify({ uploadUrl, fileName }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not start upload.";
    return json(500, message);
  }
};

function sanitizeFileName(name: string): string {
  const base = name.replace(/[/\\?%*:|"<>]/g, "_").trim() || "upload.bin";
  return base.slice(0, 180);
}

function json(status: number, message: string): Response {
  return new Response(JSON.stringify({ message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
