import type { APIRoute } from "astro";
import { getCurrentMemberId } from "../../../lib/session";
import { getFormById } from "../../../lib/forms";
import { getSubmissionById, updateInternalData } from "../../../lib/submissions";

// POST /api/submissions/update-internal
// { formId, submissionId, data } — owner-only; merges only internal field keys.
export const POST: APIRoute = async ({ request }) => {
  const memberId = await getCurrentMemberId();
  if (!memberId) return new Response("Unauthorized", { status: 401 });

  let body: { formId?: string; submissionId?: string; data?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const { formId, submissionId, data } = body;
  if (!formId || !submissionId || typeof data !== "object" || data === null) {
    return new Response("Bad Request", { status: 400 });
  }

  const form = await getFormById(formId);
  if (!form) return new Response("Not Found", { status: 404 });
  if (form.ownerId !== memberId) return new Response("Forbidden", { status: 403 });

  const sub = await getSubmissionById(submissionId);
  if (!sub || sub.formId !== formId) return new Response("Not Found", { status: 404 });

  const byId = new Map(form.internalFields.map((f) => [f.id, f]));
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const field = byId.get(key);
    if (!field) continue;
    if (field.type === "select") {
      const opts = field.options ?? [];
      const str = value == null ? "" : String(value);
      if (str !== "" && !opts.includes(str)) {
        return new Response(JSON.stringify({ message: `Invalid value for ${field.label}.` }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      patch[key] = str;
    } else {
      patch[key] = value == null ? "" : String(value);
    }
  }

  try {
    const updated = await updateInternalData(sub, patch);
    return new Response(
      JSON.stringify({ ok: true, data: updated.data }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    return new Response(JSON.stringify({ message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
