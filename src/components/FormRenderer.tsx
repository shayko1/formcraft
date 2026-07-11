import { useMemo, useState } from "react";
import {
  type FieldConfig,
  type FormTheme,
  DEFAULT_THEME,
  missingRequired,
} from "../lib/form-schema";

interface FormRendererProps {
  formId: string;
  title: string;
  description?: string;
  fields: FieldConfig[];
  theme?: FormTheme;
  /** Preview mode (builder) — inputs are inert and submit is disabled. */
  preview?: boolean;
}

type Values = Record<string, string | string[]>;

function fieldDir(f: FieldConfig, theme: FormTheme): "rtl" | "ltr" {
  if (f.dir === "rtl" || f.dir === "ltr") return f.dir;
  return theme.dir;
}

export default function FormRenderer({
  formId,
  title,
  description,
  fields,
  theme = DEFAULT_THEME,
  preview = false,
}: FormRendererProps) {
  const [values, setValues] = useState<Values>({});
  const [errors, setErrors] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  const accent = theme.accent || DEFAULT_THEME.accent;
  const style = useMemo(
    () => ({ ["--accent" as string]: accent }) as React.CSSProperties,
    [accent],
  );

  const setValue = (id: string, v: string | string[]) => {
    setValues((prev) => ({ ...prev, [id]: v }));
    if (errors.has(id)) {
      setErrors((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    }
  };

  const toggleCheckbox = (id: string, option: string) => {
    const current = Array.isArray(values[id]) ? (values[id] as string[]) : [];
    const next = current.includes(option)
      ? current.filter((o) => o !== option)
      : [...current, option];
    setValue(id, next);
  };

  const handleSubmit = async () => {
    if (preview) return;
    const missing = missingRequired(fields, values);
    if (missing.length > 0) {
      setErrors(new Set(missing));
      return;
    }
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formId, data: values }),
      });
      if (res.ok) {
        setStatus("done");
        return;
      }
      const body = await res.json().catch(() => ({}));
      setStatus("error");
      setMessage(body.message ?? "Something went wrong. Please try again.");
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  };

  const inputBase =
    "w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition focus:ring-2";
  const inputCls = (id: string) =>
    [
      inputBase,
      errors.has(id)
        ? "border-red-400 bg-red-50 focus:ring-red-300"
        : "border-slate-300 bg-white focus:border-[var(--accent)] focus:ring-[color-mix(in_srgb,var(--accent)_35%,white)]",
    ].join(" ");

  if (status === "done") {
    return (
      <div style={style} dir="auto" className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-100">
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl text-white"
          style={{ background: "var(--accent)" }}
        >
          ✓
        </div>
        <h3 className="mt-4 text-xl font-extrabold text-slate-900">Thank you!</h3>
        <p className="mt-1 text-sm text-slate-500">Your response has been recorded.</p>
      </div>
    );
  }

  return (
    <div style={style} dir={theme.dir} className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>

      <div className="space-y-4">
        {fields.map((f) => {
          const dir = fieldDir(f, theme);
          const err = errors.has(f.id);
          return (
            <div key={f.id}>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                {f.label}
                {f.required && <span className="text-red-500"> *</span>}
              </label>

              {f.type === "textarea" ? (
                <textarea
                  dir={dir}
                  rows={4}
                  disabled={preview}
                  placeholder={f.placeholder}
                  value={(values[f.id] as string) ?? ""}
                  onChange={(e) => setValue(f.id, e.target.value)}
                  className={inputCls(f.id)}
                />
              ) : f.type === "select" ? (
                <select
                  dir={dir}
                  disabled={preview}
                  value={(values[f.id] as string) ?? ""}
                  onChange={(e) => setValue(f.id, e.target.value)}
                  className={inputCls(f.id)}
                >
                  <option value="">—</option>
                  {(f.options ?? []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : f.type === "radio" ? (
                <div className="space-y-1.5">
                  {(f.options ?? []).map((o) => (
                    <label key={o} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="radio"
                        name={f.id}
                        disabled={preview}
                        checked={values[f.id] === o}
                        onChange={() => setValue(f.id, o)}
                        style={{ accentColor: "var(--accent)" }}
                      />
                      {o}
                    </label>
                  ))}
                </div>
              ) : f.type === "checkbox" ? (
                <div className="space-y-1.5">
                  {(f.options ?? []).map((o) => (
                    <label key={o} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        disabled={preview}
                        checked={Array.isArray(values[f.id]) && (values[f.id] as string[]).includes(o)}
                        onChange={() => toggleCheckbox(f.id, o)}
                        style={{ accentColor: "var(--accent)" }}
                      />
                      {o}
                    </label>
                  ))}
                </div>
              ) : (
                <input
                  type={
                    f.type === "email" ? "email" : f.type === "number" ? "number" : f.type === "phone" ? "tel" : f.type === "date" ? "date" : "text"
                  }
                  inputMode={f.type === "phone" || f.type === "number" ? "numeric" : undefined}
                  dir={dir}
                  disabled={preview}
                  placeholder={f.placeholder}
                  value={(values[f.id] as string) ?? ""}
                  onChange={(e) => setValue(f.id, e.target.value)}
                  className={inputCls(f.id)}
                />
              )}

              {err && <p className="mt-1 text-xs font-medium text-red-500">This field is required</p>}
            </div>
          );
        })}
      </div>

      {status === "error" && message && (
        <p className="text-sm font-medium text-red-600">{message}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={preview || status === "loading"}
        className="w-full rounded-xl py-3 text-base font-bold text-white shadow-lg transition hover:opacity-90 disabled:opacity-60"
        style={{ background: "var(--accent)" }}
      >
        {status === "loading" ? "Sending…" : preview ? "Submit (preview)" : "Submit"}
      </button>
    </div>
  );
}
