import { useState } from "react";
import { Icon } from "./icons";

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

const actionBtn =
  "clay-btn-secondary flex h-10 w-full items-center justify-center px-3 text-xs font-bold";

export default function FormsList({ forms: initial, origin }: FormsListProps) {
  const [forms, setForms] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const copy = async (id: string, slug: string) => {
    try {
      await navigator.clipboard.writeText(`${origin}/f/${slug}`);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1500);
    } catch {
      /* ignore */
    }
  };

  if (forms.length === 0) {
    return (
      <div className="clay-card border-dashed border-2 border-[var(--color-brand-primary)]/30 bg-[var(--color-brand-primary)]/5 p-12 text-center flex flex-col items-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)] drop-shadow-sm">
          <Icon name="FileText" className="h-10 w-10" />
        </span>
        <h3 className="mt-6 text-2xl font-bold text-[var(--color-brand-dark)]">No forms yet</h3>
        <p className="mt-2 text-base font-bold text-[var(--color-brand-muted)]">Create your first form to start collecting responses.</p>
        <a
          href="/dashboard/forms/new"
          className="mt-8 inline-block clay-btn-primary px-8 py-3 text-base font-bold"
        >
          + New form
        </a>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {forms.map((f) => (
        <div key={f.id} className="flex flex-col clay-card p-6">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-xl font-bold text-[var(--color-brand-dark)]">
              {f.title || "Untitled form"}
            </h3>
            {f.published ? (
              <span className="shrink-0 rounded-full bg-[var(--color-brand-accent)] px-3 py-1 text-xs font-bold text-white shadow-inner">
                Live
              </span>
            ) : (
              <span className="shrink-0 rounded-full bg-[var(--color-brand-light)] px-3 py-1 text-xs font-bold text-[var(--color-brand-muted)] shadow-inner">
                Draft
              </span>
            )}
          </div>
          <p className="mt-2 text-sm font-bold text-[var(--color-brand-muted)]">
            {f.submissionCount} response{f.submissionCount === 1 ? "" : "s"}
          </p>

          {/* Fixed 2×2 action grid — identical on every card */}
          <div className="mt-auto grid grid-cols-2 gap-2 pt-6">
            <a href={`/dashboard/forms/${f.id}/edit`} className={actionBtn}>
              Edit
            </a>
            <a href={`/dashboard/forms/${f.id}/submissions`} className={actionBtn}>
              Responses
            </a>
            {f.published ? (
              <button
                type="button"
                onClick={() => void copy(f.id, f.slug)}
                className={actionBtn}
              >
                {copiedId === f.id ? "Copied!" : "Copy link"}
              </button>
            ) : (
              <button
                type="button"
                disabled
                title="Publish the form to share a link"
                className={`${actionBtn} cursor-not-allowed opacity-45`}
              >
                Copy link
              </button>
            )}
            <button
              type="button"
              onClick={() => void remove(f.id, f.title)}
              disabled={busy === f.id}
              className="flex h-10 w-full items-center justify-center rounded-xl border border-red-100 bg-white px-3 text-xs font-bold text-red-500 shadow-sm transition hover:bg-red-50 disabled:opacity-50"
            >
              {busy === f.id ? "…" : "Delete"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
