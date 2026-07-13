import type { APIRoute } from "astro";
import { getCurrentMemberId } from "../../../../../lib/session";
import { getFormById } from "../../../../../lib/forms";
import { listFormVersions } from "../../../../../lib/form-versions";

async function authorizeOwner(id: string) {
  const memberId = await getCurrentMemberId();
  if (!memberId) return { error: new Response("Unauthorized", { status: 401 }) };
  const form = await getFormById(id);
  if (!form) return { error: new Response("Not Found", { status: 404 }) };
  if (form.ownerId !== memberId) return { error: new Response("Forbidden", { status: 403 }) };
  return { memberId, form };
}

/** GET /api/forms/:id/versions — published snapshots (newest first). */
export const GET: APIRoute = async ({ params }) => {
  const { id } = params;
  if (!id) return new Response("Bad Request", { status: 400 });

  const auth = await authorizeOwner(id);
  if (auth.error) return auth.error;

  const versions = await listFormVersions(id);
  return new Response(
    JSON.stringify({
      versions: versions.map((v) => ({
        id: v.id,
        version: v.version,
        title: v.title,
        createdDate: v.createdDate,
        isLive: auth.form.live?.version === v.version,
      })),
      liveVersion: auth.form.live?.version ?? null,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
};
