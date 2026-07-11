import { useState } from "react";
import * as LucideIcons from "lucide-react";

export interface TemplateCard {
  id: string;
  name: string;
  description: string;
  icon: string;
  fieldCount: number;
}

function IconRenderer({ name, className = "h-6 w-6 text-brand-600" }: { name: string; className?: string }) {
  const Icon = (LucideIcons as any)[name];
  if (!Icon) return null;
  return <Icon className={className} />;
}

export default function TemplatePicker({ templates }: { templates: TemplateCard[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const create = async (templateId: string) => {
    setBusy(templateId);
    setError(null);
    try {
      const res = await fetch("/api/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setBusy(null);
        // 403 = plan limit reached; show the upgrade message from the server.
        setError(body.message ?? `Could not create form (${res.status})`);
        return;
      }
      const { id } = await res.json();
      window.location.href = `/dashboard/forms/${id}/edit`;
    } catch (e) {
      setBusy(null);
      setError(e instanceof Error ? e.message : "Could not create form");
    }
  };

  return (
    <div>
      {error && <p className="mb-4 text-sm font-medium text-red-600">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => create(t.id)}
            disabled={busy !== null}
            className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 text-start shadow-sm transition hover:-translate-y-1 hover:border-brand-300 hover:shadow-lg disabled:opacity-60"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 transition group-hover:bg-brand-100">
              <IconRenderer name={t.icon} />
            </span>
            <h3 className="mt-4 text-base font-bold text-slate-900">{t.name}</h3>
            <p className="mt-1 flex-1 text-sm leading-relaxed text-slate-500">{t.description}</p>
            <span className="mt-4 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-brand-600">
              {busy === t.id ? "Creating…" : (
                <>
                  {t.fieldCount} fields · Use template <IconRenderer name="ArrowRight" className="h-3 w-3" />
                </>
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
