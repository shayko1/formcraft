import type { APIRoute } from "astro";
import { getCurrentMemberId } from "../../../lib/session";
import { getFormById, updateForm, deleteForm, type FormPatch } from "../../../lib/forms";
import { getQuotaStatus } from "../../../lib/plan";

async function authorizeOwner(id: string) {
  const memberId = await getCurrentMemberId();
  if (!memberId) return { error: new Response("Unauthorized", { status: 401 }) };
  const form = await getFormById(id);
  if (!form) return { error: new Response("Not Found", { status: 404 }) };
  if (form.ownerId !== memberId) return { error: new Response("Forbidden", { status: 403 }) };
  return { memberId, form };
}

// PATCH /api/forms/:id — update fields/title/theme/published (owner only).
export const PATCH: APIRoute = async ({ params, request }) => {
  const { id } = params;
  if (!id) return new Response("Bad Request", { status: 400 });

  const auth = await authorizeOwner(id);
  if (auth.error) return auth.error;

  let body: FormPatch;
  try {
    body = await request.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  // Enforce the published-form quota when transitioning to published.
  if (body.published === true && !auth.form.published) {
    const quota = await getQuotaStatus(auth.memberId);
    if (!quota.canPublishMore) {
      return new Response(
        JSON.stringify({
          message: `Your ${quota.tier} plan allows ${quota.maxPublishedForms} published form(s). Upgrade to publish more.`,
        }),
        { status: 402, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  const patch: FormPatch = {};
  if (typeof body.title === "string") patch.title = body.title;
  if (typeof body.description === "string") patch.description = body.description;
  if (Array.isArray(body.fields)) patch.fields = body.fields;
  if (body.theme) patch.theme = body.theme;
  if (typeof body.published === "boolean") patch.published = body.published;

  try {
    await updateForm(id, patch);
    return new Response(null, { status: 204 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    return new Response(JSON.stringify({ message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};

// DELETE /api/forms/:id — delete a form (owner only).
export const DELETE: APIRoute = async ({ params }) => {
  const { id } = params;
  if (!id) return new Response("Bad Request", { status: 400 });

  const auth = await authorizeOwner(id);
  if (auth.error) return auth.error;

  try {
    await deleteForm(id);
    return new Response(null, { status: 204 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Delete failed";
    return new Response(JSON.stringify({ message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
