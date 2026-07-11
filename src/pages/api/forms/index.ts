import type { APIRoute } from "astro";
import { getCurrentMemberId, loginRedirect } from "../../../lib/session";
import { createForm } from "../../../lib/forms";
import { getTemplate } from "../../../lib/templates";
import { getQuotaStatus } from "../../../lib/plan";
import {
  ensureCanvasLayouts,
  type FieldConfig,
  type LayoutMode,
} from "../../../lib/form-schema";

const fid = () => Math.random().toString(36).slice(2, 10);

async function readBody(request: Request): Promise<{ templateId: string; layoutMode: LayoutMode }> {
  const ctype = request.headers.get("content-type") ?? "";
  if (ctype.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as {
      templateId?: string;
      layoutMode?: string;
    };
    return {
      templateId: body.templateId ?? "custom",
      layoutMode: body.layoutMode === "canvas" ? "canvas" : "stack",
    };
  }
  const form = await request.formData().catch(() => null);
  const id = form?.get("templateId");
  const mode = form?.get("layoutMode");
  return {
    templateId: typeof id === "string" && id ? id : "custom",
    layoutMode: mode === "canvas" ? "canvas" : "stack",
  };
}

function wantsRedirect(request: Request): boolean {
  const ctype = request.headers.get("content-type") ?? "";
  const accept = request.headers.get("accept") ?? "";
  if (ctype.includes("application/json")) return false;
  if (accept.includes("application/json")) return false;
  return true;
}

// POST /api/forms  { templateId, layoutMode? } → creates a draft form from a template.
export const POST: APIRoute = async ({ request }) => {
  const ownerId = await getCurrentMemberId();
  const redirect = wantsRedirect(request);

  if (!ownerId) {
    if (redirect) {
      return Response.redirect(new URL(loginRedirect("/dashboard/forms/new"), request.url), 303);
    }
    return new Response(JSON.stringify({ message: "Please sign in again." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const quota = await getQuotaStatus(ownerId);
  if (!quota.canCreateForm) {
    const message = `Your ${quota.tier} plan is limited to ${quota.maxForms} form${quota.maxForms === 1 ? "" : "s"}. Upgrade to Pro for unlimited forms.`;
    if (redirect) {
      return Response.redirect(
        new URL(`/dashboard/forms/new?error=${encodeURIComponent(message)}`, request.url),
        303,
      );
    }
    return new Response(JSON.stringify({ upgrade: true, message }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  let templateId = "custom";
  let layoutMode: LayoutMode = "stack";
  try {
    ({ templateId, layoutMode } = await readBody(request));
  } catch {
    if (redirect) {
      return Response.redirect(new URL("/dashboard/forms/new?error=Bad+request", request.url), 303);
    }
    return new Response("Bad Request", { status: 400 });
  }

  const template = getTemplate(templateId) ?? getTemplate("custom")!;
  let fields: FieldConfig[] = template.fields.map((f) => ({ ...f, id: fid() }));
  if (layoutMode === "canvas") {
    fields = ensureCanvasLayouts(fields);
  }
  const theme = { ...template.theme, layoutMode };

  try {
    const form = await createForm({
      ownerId,
      title: template.id === "custom" ? "Untitled form" : template.name,
      templateId: template.id,
      fields,
      theme,
    });

    if (!form.id) {
      throw new Error("Form was created but no id was returned");
    }

    if (redirect) {
      return Response.redirect(new URL(`/dashboard/forms/${form.id}/edit`, request.url), 303);
    }
    return new Response(JSON.stringify({ id: form.id, slug: form.slug }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create form";
    if (redirect) {
      return Response.redirect(
        new URL(`/dashboard/forms/new?error=${encodeURIComponent(message)}`, request.url),
        303,
      );
    }
    return new Response(JSON.stringify({ message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
