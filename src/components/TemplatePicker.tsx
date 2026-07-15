import { useState } from "react";
import { Icon } from "./icons";

export interface TemplateCard {
  id: string;
  name: string;
  description: string;
  icon: string;
  fieldCount: number;
}

/**
 * Real HTML forms so "Use template" works even if React never hydrates.
 * With JS: fetch + inline errors. Without JS: native POST → server redirect.
 */
export default function TemplatePicker({
  templates,
  initialError,
}: {
  templates: TemplateCard[];
  initialError?: string | null;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError ?? null);

  const createWithFetch = async (templateId: string) => {
    setBusy(templateId);
    setError(null);
    try {
      const res = await fetch("/api/forms", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ templateId }),
      });
      if (res.status === 401) {
        window.location.href = `/api/auth/login?returnToUrl=${encodeURIComponent("/dashboard/forms/new")}`;
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setBusy(null);
        setError(body.message ?? `Could not create form (${res.status})`);
        return;
      }
      const data = await res.json();
      if (!data?.id) {
        setBusy(null);
        setError("Form created but missing id — refresh and try again");
        return;
      }
      window.location.href = `/dashboard/forms/${data.id}/edit`;
    } catch (e) {
      setBusy(null);
      setError(e instanceof Error ? e.message : "Could not create form");
    }
  };

  return (
    <div>
      {error && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <form
            key={t.id}
            method="POST"
            action="/api/forms"
            onSubmit={(e) => {
              e.preventDefault();
              if (busy) return;
              void createWithFetch(t.id);
            }}
          >
            <input type="hidden" name="templateId" value={t.id} />
            <button
              type="submit"
              disabled={busy !== null}
              className="group flex h-full w-full flex-col rounded-2xl border border-slate-200 bg-white p-6 text-start shadow-sm transition hover:-translate-y-1 hover:border-brand-300 hover:shadow-lg disabled:opacity-60"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 transition group-hover:bg-brand-100">
                <Icon name={t.icon} />
              </span>
              <h3 className="mt-4 text-base font-bold text-slate-900">{t.name}</h3>
              <p className="mt-1 flex-1 text-sm leading-relaxed text-slate-500">{t.description}</p>
              <span className="mt-4 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-brand-600">
                {busy === t.id ? (
                  "Creating…"
                ) : (
                  <>
                    {t.fieldCount} fields · Use template{" "}
                    <Icon name="ArrowRight" className="h-3 w-3" />
                  </>
                )}
              </span>
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
