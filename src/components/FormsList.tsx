import { useState } from "react";

export interface FormSummary {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  submissionCount: number;
  templateId: string;
}

interface FormsListProps {
  forms: FormSummary[];
  origin: string;
}

export default function FormsList({ forms: initial, origin }: FormsListProps) {
  const [forms, setForms] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  const remove = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}" and all its responses? This cannot be undone.`)) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/forms/${id}`, { method: "DELETE" });
      if (res.ok) setForms((prev) => prev.filter((f) => f.id !== id));
    } finally {
      setBusy(null);
    }
  };

  const copy = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(`${origin}/f/${slug}`);
    } catch {
      /* ignore */
    }
  };

  if (forms.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
        <span className="text-4xl">📝</span>
        <h3 className="mt-4 text-lg font-bold text-slate-900">No forms yet</h3>
        <p className="mt-1 text-sm text-slate-500">Create your first form to start collecting responses.</p>
        <a
          href="/dashboard/forms/new"
          className="mt-6 inline-block rounded-xl bg-grad-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
        >
          + New form
        </a>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {forms.map((f) => (
        <div key={f.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-base font-bold text-slate-900">{f.title || "Untitled form"}</h3>
            {f.published ? (
              <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Live</span>
            ) : (
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">Draft</span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">{f.submissionCount} response{f.submissionCount === 1 ? "" : "s"}</p>

          <div className="mt-4 flex flex-1 flex-wrap items-end gap-2">
            <a href={`/dashboard/forms/${f.id}/edit`} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700">
              Edit
            </a>
            <a href={`/dashboard/forms/${f.id}/submissions`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
              Responses
            </a>
            {f.published && (
              <button onClick={() => copy(f.slug)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                Copy link
              </button>
            )}
            <button
              onClick={() => remove(f.id, f.title)}
              disabled={busy === f.id}
              className="ms-auto rounded-lg px-2 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-50 disabled:opacity-50"
            >
              {busy === f.id ? "…" : "Delete"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
