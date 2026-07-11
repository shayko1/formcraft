import type { APIRoute } from "astro";
import { getFormById, updateForm } from "../../lib/forms";
import { insertSubmission, existsWithValue } from "../../lib/submissions";
import { validateFields, isPhoneField, isEmptyValue } from "../../lib/form-schema";

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

  const fieldErrors = validateFields(form.fields, data);
  if (fieldErrors.length > 0) {
    return json(400, fieldErrors[0]?.message ?? "Please check the highlighted fields.");
  }

  // NOTE: no response-quota rejection here — responses are ALWAYS collected and stored.
  // Free-tier limits only cap how many are shown in the admin panel (see submissions page).

  // Duplicate guard on the first phone-like field (opt-out via theme.allowDuplicateResponses).
  if (!form.theme.allowDuplicateResponses) {
    const phoneField = form.fields.find(isPhoneField);
    if (phoneField && !isEmptyValue(data[phoneField.id])) {
      const dup = await existsWithValue(formId, phoneField.id, String(data[phoneField.id]));
      if (dup) return json(409, "A response with this phone number already exists.");
    }
  }

  try {
    // Only persist public field answers — strip unknown / internal keys.
    const allowed = new Set(form.fields.map((f) => f.id));
    const clean: Record<string, unknown> = {};
    for (const key of Object.keys(data)) {
      if (allowed.has(key)) clean[key] = data[key];
    }
    await insertSubmission(formId, form.ownerId, clean);
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
