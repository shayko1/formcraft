import type { APIRoute } from "astro";
import { getCurrentMemberId } from "../../../lib/session";
import { getFormById } from "../../../lib/forms";
import { listSubmissions, markExported } from "../../../lib/submissions";
import { getVisibleSubmissionsLimit } from "../../../lib/plan";
import { buildCsv } from "../../../lib/csv";

// POST /api/submissions/export  { formId, ids } — CSV of selected rows + mark exported.
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

  // Only rows visible under the owner's plan are exportable (hidden overflow stays hidden).
  const limit = await getVisibleSubmissionsLimit(memberId);
  const all = await listSubmissions(formId);
  const visible = Number.isFinite(limit) ? all.slice(0, limit) : all;
  const idSet = new Set(ids);
  const selected = visible.filter((s) => idSet.has(s.id));

  const headers = [
    ...form.fields.map((f) => ({ id: f.id, label: f.label })),
    { id: "_createdDate", label: "Submitted" },
  ];
  const csvRows = selected.map((s) => ({ ...s.data, _createdDate: s.createdDate }));
  const csv = buildCsv(headers, csvRows);

  await markExported(selected);

  const filename = `${form.slug || "responses"}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
};
