import type { APIRoute } from "astro";
import { getCurrentMemberId } from "../../../../lib/session";
import { getFormById, unpublishForm } from "../../../../lib/forms";

async function authorizeOwner(id: string) {
  const memberId = await getCurrentMemberId();
  if (!memberId) return { error: new Response("Unauthorized", { status: 401 }) };
  const form = await getFormById(id);
  if (!form) return { error: new Response("Not Found", { status: 404 }) };
  if (form.ownerId !== memberId) return { error: new Response("Forbidden", { status: 403 }) };
  return { memberId, form };
}

/** POST /api/forms/:id/unpublish — stop accepting responses; keep live snapshot. */
export const POST: APIRoute = async ({ params }) => {
  const { id } = params;
  if (!id) return new Response("Bad Request", { status: 400 });

  const auth = await authorizeOwner(id);
  if (auth.error) return auth.error;

  try {
    await unpublishForm(id);
    return new Response(null, { status: 204 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unpublish failed";
    return new Response(JSON.stringify({ message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
