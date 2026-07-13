import type { APIRoute } from "astro";
import { getCurrentMemberId } from "../../../../lib/session";
import { getFormById, publishForm } from "../../../../lib/forms";
import type { FieldConfig, FormTheme, InternalFieldConfig } from "../../../../lib/form-schema";

async function authorizeOwner(id: string) {
  const memberId = await getCurrentMemberId();
  if (!memberId) return { error: new Response("Unauthorized", { status: 401 }) };
  const form = await getFormById(id);
  if (!form) return { error: new Response("Not Found", { status: 404 }) };
  if (form.ownerId !== memberId) return { error: new Response("Forbidden", { status: 403 }) };
  return { memberId, form };
}

/** POST /api/forms/:id/publish — save draft as live + version. */
export const POST: APIRoute = async ({ params, request }) => {
  const { id } = params;
  if (!id) return new Response("Bad Request", { status: 400 });

  const auth = await authorizeOwner(id);
  if (auth.error) return auth.error;

  let body: {
    title?: string;
    description?: string;
    fields?: FieldConfig[];
    internalFields?: InternalFieldConfig[];
    theme?: FormTheme;
  } = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  try {
    const result = await publishForm(id, body);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Publish failed";
    return new Response(JSON.stringify({ message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
