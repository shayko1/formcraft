import type { APIRoute } from "astro";
import { getCurrentMemberId } from "../../../../../../lib/session";
import { getFormById, restoreDraftFromSnapshot } from "../../../../../../lib/forms";
import { getFormVersion } from "../../../../../../lib/form-versions";

async function authorizeOwner(formId: string) {
  const memberId = await getCurrentMemberId();
  if (!memberId) return { error: new Response("Unauthorized", { status: 401 }) };
  const form = await getFormById(formId);
  if (!form) return { error: new Response("Not Found", { status: 404 }) };
  if (form.ownerId !== memberId) return { error: new Response("Forbidden", { status: 403 }) };
  return { memberId, form };
}

/** POST /api/forms/:id/versions/:versionId/restore — load version into draft only. */
export const POST: APIRoute = async ({ params }) => {
  const { id, versionId } = params;
  if (!id || !versionId) return new Response("Bad Request", { status: 400 });

  const auth = await authorizeOwner(id);
  if (auth.error) return auth.error;

  const version = await getFormVersion(versionId);
  if (!version || version.formId !== id) {
    return new Response("Not Found", { status: 404 });
  }

  try {
    await restoreDraftFromSnapshot(id, {
      title: version.title,
      description: version.description,
      fields: version.fields,
      theme: version.theme,
    });
    return new Response(
      JSON.stringify({
        title: version.title,
        description: version.description,
        fields: version.fields,
        theme: version.theme,
        version: version.version,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Restore failed";
    return new Response(JSON.stringify({ message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
