import type { APIRoute } from "astro";
import { getCurrentMemberId } from "../../../lib/session";
import { getFormById } from "../../../lib/forms";
import { deleteSubmissions } from "../../../lib/submissions";

// POST /api/submissions/delete  { formId, ids } — bulk delete (owner only).
export const POST: APIRoute = async ({ request }) => {
  const memberId = await getCurrentMemberId();
  if (!memberId) return new Response("Unauthorized", { status: 401 });

  let body: { formId?: string; ids?: string[] };
  try {
    body = await request.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const { formId, ids } = body;
  if (!formId || !Array.isArray(ids) || ids.length === 0) {
    return new Response("Bad Request", { status: 400 });
  }

  const form = await getFormById(formId);
  if (!form) return new Response("Not Found", { status: 404 });
  if (form.ownerId !== memberId) return new Response("Forbidden", { status: 403 });

  try {
    await deleteSubmissions(ids);
    return new Response(null, { status: 204 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Delete failed";
    return new Response(JSON.stringify({ message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
