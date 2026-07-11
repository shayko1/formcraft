import type { APIRoute } from "astro";
import { getFormById, updateForm } from "../../../lib/forms";
import type { TrackEvent } from "../../../lib/analytics";

// POST /api/analytics/track  { formId, event: "view"|"start" } — public, fire-and-forget safe.
export const POST: APIRoute = async ({ request }) => {
  let body: { formId?: string; event?: string };
  try {
    body = await request.json();
  } catch {
    return json(400, "Malformed request.");
  }

  const { formId, event } = body;
  if (!formId || (event !== "view" && event !== "start")) {
    return json(400, "Missing formId or invalid event.");
  }

  const form = await getFormById(formId);
  if (!form) return json(404, "This form does not exist.");
  if (!form.published) return json(403, "This form is not accepting responses.");

  const patch =
    (event as TrackEvent) === "view"
      ? { viewCount: form.viewCount + 1 }
      : { startCount: form.startCount + 1 };

  try {
    await updateForm(formId, patch);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return json(500, "Could not record event.");
  }
};

function json(status: number, message: string): Response {
  return new Response(JSON.stringify({ message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
