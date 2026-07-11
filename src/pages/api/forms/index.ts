import type { APIRoute } from "astro";
import { getCurrentMemberId } from "../../../lib/session";
import { createForm } from "../../../lib/forms";
import { getTemplate } from "../../../lib/templates";
import type { FieldConfig } from "../../../lib/form-schema";

const fid = () => Math.random().toString(36).slice(2, 10);

// POST /api/forms  { templateId } → creates a draft form from a template.
export const POST: APIRoute = async ({ request }) => {
  const ownerId = await getCurrentMemberId();
  if (!ownerId) return new Response("Unauthorized", { status: 401 });

  let body: { templateId?: string };
  try {
    body = await request.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const template = getTemplate(body.templateId ?? "custom") ?? getTemplate("custom")!;
  const fields: FieldConfig[] = template.fields.map((f) => ({ ...f, id: fid() }));

  try {
    const form = await createForm({
      ownerId,
      title: template.id === "custom" ? "Untitled form" : template.name,
      templateId: template.id,
      fields,
      theme: template.theme,
    });
    return new Response(JSON.stringify({ id: form.id, slug: form.slug }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create form";
    return new Response(JSON.stringify({ message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
