import { useMemo, useState } from "react";
import {
  type FieldConfig,
  type FormTheme,
  DEFAULT_THEME,
  validateFields,
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

function inputType(type: FieldConfig["type"]): string {
  switch (type) {
    case "email":
      return "email";
    case "number":
      return "number";
    case "phone":
      return "tel";
    case "date":
      return "date";
    case "time":
      return "time";
    case "url":
      return "url";
    default:
      return "text";
  }
}

function inputModeFor(type: FieldConfig["type"]): React.HTMLAttributes<HTMLInputElement>["inputMode"] {
  if (type === "phone") return "tel";
  if (type === "number") return "numeric";
  if (type === "email") return "email";
  if (type === "url") return "url";
  return undefined;
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  const mergedTheme = { ...DEFAULT_THEME, ...theme };
  const accent = mergedTheme.accent || DEFAULT_THEME.accent;
  const style = useMemo(
    () => ({ ["--accent" as string]: accent }) as React.CSSProperties,
    [accent],
  );

  const setValue = (id: string, v: string | string[]) => {
    setValues((prev) => ({ ...prev, [id]: v }));
    if (errors[id]) {
      setErrors((prev) => {
        const n = { ...prev };
        delete n[id];
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
    const fieldErrors = validateFields(fields, values);
    if (fieldErrors.length > 0) {
      const map: Record<string, string> = {};
      for (const e of fieldErrors) map[e.id] = e.message;
      setErrors(map);
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
      errors[id]
        ? "border-red-400 bg-red-50 focus:ring-red-300"
        : "border-slate-300 bg-white focus:border-[var(--accent)] focus:ring-[color-mix(in_srgb,var(--accent)_35%,white)]",
    ].join(" ");

  if (status === "done") {
    return (
      <div
        style={style}
        dir="auto"
        className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-100"
      >
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl text-white"
          style={{ background: "var(--accent)" }}
        >
          ✓
        </div>
        <h3 className="mt-4 text-xl font-extrabold text-slate-900">
          {mergedTheme.thankYouTitle || DEFAULT_THEME.thankYouTitle}
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          {mergedTheme.thankYouMessage || DEFAULT_THEME.thankYouMessage}
        </p>
      </div>
    );
  }

  return (
    <div style={style} dir={mergedTheme.dir} className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>

      <div className="space-y-4">
        {fields.map((f) => {
          const dir = fieldDir(f, mergedTheme);
          const err = errors[f.id];
          return (
            <div key={f.id}>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                {f.label}
                {f.required && <span className="text-red-500"> *</span>}
              </label>

              {f.type === "file" ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3.5 py-4 text-center text-sm text-slate-400">
                  File uploads coming soon
                </div>
              ) : f.type === "textarea" ? (
                <textarea
                  dir={dir}
                  rows={4}
                  disabled={preview}
                  placeholder={f.placeholder}
                  minLength={f.min}
                  maxLength={f.max}
                  value={(values[f.id] as string) ?? ""}
                  onChange={(e) => setValue(f.id, e.target.value)}
                  className={inputCls(f.id)}
                  aria-invalid={!!err}
                  aria-describedby={f.helpText ? `${f.id}-help` : undefined}
                />
              ) : f.type === "select" ? (
                <select
                  dir={dir}
                  disabled={preview}
                  value={(values[f.id] as string) ?? ""}
                  onChange={(e) => setValue(f.id, e.target.value)}
                  className={inputCls(f.id)}
                  aria-invalid={!!err}
                >
                  <option value="">{f.placeholder || "—"}</option>
                  {(f.options ?? []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : f.type === "radio" ? (
                <div className="space-y-1.5" role="radiogroup" aria-label={f.label}>
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
                <div className="space-y-1.5" role="group" aria-label={f.label}>
                  {(f.options ?? []).map((o) => (
                    <label key={o} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        disabled={preview}
                        checked={
                          Array.isArray(values[f.id]) &&
                          (values[f.id] as string[]).includes(o)
                        }
                        onChange={() => toggleCheckbox(f.id, o)}
                        style={{ accentColor: "var(--accent)" }}
                      />
                      {o}
                    </label>
                  ))}
                </div>
              ) : (
                <input
                  type={inputType(f.type)}
                  inputMode={inputModeFor(f.type)}
                  dir={dir}
                  disabled={preview}
                  placeholder={f.placeholder}
                  min={f.type === "number" ? f.min : undefined}
                  max={f.type === "number" ? f.max : undefined}
                  minLength={f.type === "text" ? f.min : undefined}
                  maxLength={f.type === "text" ? f.max : undefined}
                  value={(values[f.id] as string) ?? ""}
                  onChange={(e) => setValue(f.id, e.target.value)}
                  className={inputCls(f.id)}
                  aria-invalid={!!err}
                  aria-describedby={f.helpText ? `${f.id}-help` : undefined}
                />
              )}

              {f.helpText && (
                <p id={`${f.id}-help`} className="mt-1 text-xs text-slate-400">
                  {f.helpText}
                </p>
              )}
              {err && <p className="mt-1 text-xs font-medium text-red-500">{err}</p>}
            </div>
          );
        })}
      </div>

      {status === "error" && message && (
        <p className="text-sm font-medium text-red-600">{message}</p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={preview || status === "loading"}
        className="w-full rounded-xl py-3 text-base font-bold text-white shadow-lg transition hover:opacity-90 disabled:opacity-60"
        style={{ background: "var(--accent)" }}
      >
        {status === "loading"
          ? "Sending…"
          : preview
            ? `${mergedTheme.submitLabel || DEFAULT_THEME.submitLabel} (preview)`
            : mergedTheme.submitLabel || DEFAULT_THEME.submitLabel}
      </button>
    </div>
  );
}
