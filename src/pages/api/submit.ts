import type { APIRoute } from "astro";
import { getFormById, updateForm } from "../../lib/forms";
import { insertSubmission, existsWithValue } from "../../lib/submissions";
import { canAcceptSubmission } from "../../lib/plan";
import { missingRequired, isPhoneField, isEmptyValue } from "../../lib/form-schema";

// POST /api/submit  { formId, data } — public endpoint, no auth.
export const POST: APIRoute = async ({ request }) => {
  let body: { formId?: string; data?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return json(400, "Malformed request.");
  }

  const { formId, data } = body;
  if (!formId || typeof data !== "object" || data === null) {
    return json(400, "Missing form data.");
  }

  const form = await getFormById(formId);
  if (!form) return json(404, "This form does not exist.");
  if (!form.published) return json(403, "This form is not accepting responses.");

  const missing = missingRequired(form.fields, data);
  if (missing.length > 0) return json(400, "Please fill in all required fields.");

  if (!(await canAcceptSubmission(form.ownerId))) {
    return json(402, "This form has reached its monthly response limit.");
  }

  // Duplicate guard on the first phone-like field, if present.
  const phoneField = form.fields.find(isPhoneField);
  if (phoneField && !isEmptyValue(data[phoneField.id])) {
    const dup = await existsWithValue(formId, phoneField.id, String(data[phoneField.id]));
    if (dup) return json(409, "A response with this phone number already exists.");
  }

  try {
    await insertSubmission(formId, form.ownerId, data);
    // Best-effort denormalized counter — never blocks the submission.
    updateForm(formId, { submissionCount: form.submissionCount + 1 }).catch(() => {});
    return new Response(JSON.stringify({ ok: true }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return json(500, "Could not save your response. Please try again.");
  }
};

function json(status: number, message: string): Response {
  return new Response(JSON.stringify({ message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
