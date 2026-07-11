import { useEffect, useMemo, useRef, useState } from "react";
import {
  type FieldConfig,
  type FormTheme,
  DEFAULT_THEME,
  DEFAULT_CANVAS_WIDTH,
  isDecorativeField,
  isDarkCardBackground,
  resolveFieldBackground,
  usesCanvasLayout,
  validateFields,
} from "../lib/form-schema";
import { canvasHeight } from "../lib/canvas-snap";

function trackOnce(formId: string, event: "view" | "start") {
  try {
    const key = `fc:${event}:${formId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    // sessionStorage unavailable — still attempt track (may over-count)
  }
  void fetch("/api/analytics/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ formId, event }),
    keepalive: true,
  }).catch(() => {});
}

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

async function postSubmission(
  formId: string,
  data: Values,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formId, data }),
    });
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => ({}));
    return { ok: false, message: body.message ?? "Something went wrong. Please try again." };
  } catch {
    return { ok: false, message: "Network error. Please try again." };
  }
}

function fieldLabelStyle(f: FieldConfig): React.CSSProperties {
  return {
    color: f.style?.labelColor || undefined,
    fontSize: f.style?.labelSize ? `${f.style.labelSize}px` : undefined,
  };
}

function CanvasStage({
  width,
  height,
  children,
}: {
  width: number;
  height: number;
  children: React.ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const avail = Math.max(200, el.clientWidth);
      setScale(Math.min(1, avail / width));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  return (
    <div ref={wrapRef} className="w-full min-w-0">
      <div className="relative mx-auto" style={{ width: width * scale, height: height * scale }}>
        <div
          className="absolute start-0 top-0 origin-top-left"
          style={{ width, minHeight: height, transform: `scale(${scale})` }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export default function FormRenderer({
  formId,
  title,
  description,
  fields,
  theme = DEFAULT_THEME,
  preview = false,
}: FormRendererProps) {
  const [rows, setRows] = useState<Values[]>([{}]);
  const [rowErrors, setRowErrors] = useState<Record<string, string>[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string>("");
  const started = useRef(false);

  const mergedTheme = { ...DEFAULT_THEME, ...theme };
  const multi = !!mergedTheme.allowMultipleEntries;
  const accent = mergedTheme.accent || DEFAULT_THEME.accent;
  const canvas = usesCanvasLayout(mergedTheme, fields);
  const darkCard = isDarkCardBackground(mergedTheme);
  const artboardW = mergedTheme.canvasWidth ?? DEFAULT_CANVAS_WIDTH;
  const artboardH = canvasHeight(fields, 400);
  const style = useMemo(
    () => ({ ["--accent" as string]: accent }) as React.CSSProperties,
    [accent],
  );

  // Inputs for submit (skip decorative)
  const inputFields = useMemo(
    () => fields.filter((f) => !isDecorativeField(f.type)),
    [fields],
  );

  useEffect(() => {
    if (preview) return;
    trackOnce(formId, "view");
  }, [formId, preview]);

  const markStarted = () => {
    if (preview || started.current) return;
    started.current = true;
    trackOnce(formId, "start");
  };

  const setValue = (rowIndex: number, id: string, v: string | string[]) => {
    markStarted();
    setRows((prev) => prev.map((row, i) => (i === rowIndex ? { ...row, [id]: v } : row)));
    setRowErrors((prev) =>
      prev.map((errs, i) => {
        if (i !== rowIndex || !errs[id]) return errs;
        const next = { ...errs };
        delete next[id];
        return next;
      }),
    );
  };

  const toggleCheckbox = (rowIndex: number, id: string, option: string) => {
    const current = Array.isArray(rows[rowIndex]?.[id])
      ? (rows[rowIndex]![id] as string[])
      : [];
    const next = current.includes(option)
      ? current.filter((o) => o !== option)
      : [...current, option];
    setValue(rowIndex, id, next);
  };

  const addRow = () => {
    if (!multi) return;
    setRows((prev) => [...prev, {}]);
    setRowErrors((prev) => [...prev, {}]);
  };

  const removeRow = (index: number) => {
    if (rows.length <= 1) return;
    setRows((prev) => prev.filter((_, i) => i !== index));
    setRowErrors((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (preview) return;
    const nextErrors = rows.map((row) => {
      const fieldErrors = validateFields(inputFields, row);
      const map: Record<string, string> = {};
      for (const e of fieldErrors) map[e.id] = e.message;
      return map;
    });
    if (nextErrors.some((m) => Object.keys(m).length > 0)) {
      setRowErrors(nextErrors);
      setStatus("error");
      setMessage("Please fix the highlighted fields.");
      return;
    }

    setStatus("loading");
    setMessage("");

    const results = await Promise.all(rows.map((row) => postSubmission(formId, row)));
    const failed = results.filter((r) => !r.ok);
    const saved = results.length - failed.length;

    if (failed.length === 0) {
      setStatus("done");
      return;
    }

    setStatus("error");
    if (saved > 0) {
      setMessage(
        `Saved ${saved} of ${results.length} responses. ${failed[0]?.ok === false ? failed[0].message : "Please try again."}`,
      );
      const remaining: Values[] = [];
      const remainingErrors: Record<string, string>[] = [];
      results.forEach((r, i) => {
        if (!r.ok) {
          remaining.push(rows[i]!);
          remainingErrors.push({});
        }
      });
      setRows(remaining.length ? remaining : [{}]);
      setRowErrors(remainingErrors.length ? remainingErrors : [{}]);
    } else {
      setMessage(failed[0]?.ok === false ? failed[0].message : "Something went wrong. Please try again.");
    }
  };

  const inputBase =
    "w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition focus:ring-2";
  const inputCls = (err?: string) =>
    [
      inputBase,
      err
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

  const renderOneField = (
    f: FieldConfig,
    rowIndex: number,
    values: Values,
    errors: Record<string, string>,
    opts?: { compact?: boolean },
  ) => {
    const dir = fieldDir(f, mergedTheme);
    const err = errors[f.id];
    const helpId = `${f.id}-r${rowIndex}-help`;
    const radioName = `${f.id}__${rowIndex}`;
    const labelStyle = fieldLabelStyle(f);
    const textStyle: React.CSSProperties = {
      color: f.style?.textColor || undefined,
      fontSize: f.style?.fontSize ? `${f.style.fontSize}px` : undefined,
    };

    if (f.type === "heading") {
      return (
        <div
          key={f.id}
          dir={mergedTheme.dir}
          className="text-start font-extrabold leading-tight text-slate-900"
          style={{
            color: f.style?.labelColor || "#0f172a",
            fontSize: f.style?.labelSize ? `${f.style.labelSize}px` : "28px",
          }}
        >
          {f.label}
        </div>
      );
    }

    if (f.type === "image") {
      return (
        <div key={f.id} className="h-full w-full overflow-hidden rounded-lg bg-slate-100">
          {f.src ? (
            <img
              src={f.src}
              alt={f.label || ""}
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : null}
        </div>
      );
    }

    if (f.type === "file") {
      return (
        <div key={f.id} dir={mergedTheme.dir} className="text-start">
          <label
            className="mb-1.5 block text-start text-sm font-semibold text-slate-700"
            style={labelStyle}
          >
            {f.label}
          </label>
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3.5 py-4 text-center text-sm text-slate-400">
            File uploads coming soon
          </div>
        </div>
      );
    }

    return (
      <div
        key={f.id}
        dir={mergedTheme.dir}
        style={textStyle}
        className={["text-start", opts?.compact ? "h-full" : undefined].filter(Boolean).join(" ")}
      >
        <label
          className={[
            "mb-1.5 block text-start font-semibold",
            opts?.compact ? "text-xs" : "text-sm",
            darkCard ? "text-slate-100" : "text-slate-700",
          ].join(" ")}
          style={labelStyle}
        >
          {f.label}
          {f.required && <span className="text-red-500"> *</span>}
        </label>

        {f.type === "textarea" ? (
          <textarea
            dir={dir}
            rows={opts?.compact ? 3 : 4}
            disabled={preview}
            placeholder={f.placeholder}
            minLength={f.min}
            maxLength={f.max}
            value={(values[f.id] as string) ?? ""}
            onFocus={markStarted}
            onChange={(e) => setValue(rowIndex, f.id, e.target.value)}
            className={inputCls(err)}
            aria-invalid={!!err}
            aria-describedby={f.helpText ? helpId : undefined}
          />
        ) : f.type === "select" ? (
          <select
            dir={dir}
            disabled={preview}
            value={(values[f.id] as string) ?? ""}
            onFocus={markStarted}
            onChange={(e) => setValue(rowIndex, f.id, e.target.value)}
            className={inputCls(err)}
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
                  name={radioName}
                  disabled={preview}
                  checked={values[f.id] === o}
                  onFocus={markStarted}
                  onChange={() => setValue(rowIndex, f.id, o)}
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
                    Array.isArray(values[f.id]) && (values[f.id] as string[]).includes(o)
                  }
                  onFocus={markStarted}
                  onChange={() => toggleCheckbox(rowIndex, f.id, o)}
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
            onFocus={markStarted}
            onChange={(e) => setValue(rowIndex, f.id, e.target.value)}
            className={inputCls(err)}
            aria-invalid={!!err}
            aria-describedby={f.helpText ? helpId : undefined}
          />
        )}

        {f.helpText && (
          <p id={helpId} className="mt-1 text-xs text-slate-400">
            {f.helpText}
          </p>
        )}
        {err && <p className="mt-1 text-xs font-medium text-red-500">{err}</p>}
      </div>
    );
  };

  const renderStackFields = (rowIndex: number, values: Values, errors: Record<string, string>) => (
    <div className="space-y-4">
      {fields.map((f) => renderOneField(f, rowIndex, values, errors))}
    </div>
  );

  const renderCanvasFields = (rowIndex: number, values: Values, errors: Record<string, string>) => {
    const sorted = [...fields].sort((a, b) => (a.layout?.z ?? 0) - (b.layout?.z ?? 0));
    return (
      <CanvasStage width={artboardW} height={artboardH}>
        <div className="relative" style={{ width: artboardW, minHeight: artboardH }}>
          {sorted.map((f) => {
            const l = f.layout;
            if (!l) return renderOneField(f, rowIndex, values, errors);
            const fieldBg = resolveFieldBackground(f.style, { darkCard });
            const hasFill =
              !!fieldBg.backgroundColor || !!fieldBg.className;
            return (
              <div
                key={f.id}
                className={[
                  "absolute overflow-hidden rounded-lg",
                  hasFill ? "p-2" : "",
                  fieldBg.className,
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{
                  left: l.x,
                  top: l.y,
                  width: l.w,
                  height: l.h,
                  zIndex: l.z,
                  ...(fieldBg.backgroundColor
                    ? { backgroundColor: fieldBg.backgroundColor }
                    : {}),
                }}
              >
                {renderOneField(f, rowIndex, values, errors, { compact: true })}
              </div>
            );
          })}
        </div>
      </CanvasStage>
    );
  };

  return (
    <div
      style={style}
      dir={mergedTheme.dir}
      className={["space-y-5", darkCard ? "text-slate-100" : ""].join(" ")}
    >
      {!canvas && (
        <div className="text-start">
          <h1
            className={[
              "text-2xl font-extrabold",
              darkCard ? "text-white" : "text-slate-900",
            ].join(" ")}
          >
            {title}
          </h1>
          {description && (
            <p className={["mt-1 text-sm", darkCard ? "text-slate-300" : "text-slate-500"].join(" ")}>
              {description}
            </p>
          )}
        </div>
      )}

      {canvas && (title || description) && (
        <div className="px-1 text-start">
          <h1
            className={[
              "text-xl font-extrabold sm:text-2xl",
              darkCard ? "text-white" : "text-slate-900",
            ].join(" ")}
          >
            {title}
          </h1>
          {description && (
            <p className={["mt-1 text-sm", darkCard ? "text-slate-300" : "text-slate-500"].join(" ")}>
              {description}
            </p>
          )}
        </div>
      )}

      <div className="space-y-4">
        {rows.map((values, rowIndex) => {
          const errors = rowErrors[rowIndex] ?? {};
          const body = canvas
            ? renderCanvasFields(rowIndex, values, errors)
            : renderStackFields(rowIndex, values, errors);
          if (!multi) return <div key={rowIndex}>{body}</div>;
          return (
            <div
              key={rowIndex}
              className="relative rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200"
            >
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(rowIndex)}
                  aria-label="Remove response"
                  className="absolute end-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                >
                  ×
                </button>
              )}
              {rows.length > 1 && (
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Response {rowIndex + 1}
                </p>
              )}
              {body}
            </div>
          );
        })}
      </div>

      {multi && (
        <button
          type="button"
          onClick={addRow}
          className="flex w-full items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[color-mix(in_srgb,var(--accent)_45%,white)] py-3 text-sm font-medium transition hover:bg-[color-mix(in_srgb,var(--accent)_8%,white)]"
          style={{ color: "var(--accent)" }}
        >
          + {mergedTheme.addEntryLabel || DEFAULT_THEME.addEntryLabel}
        </button>
      )}

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
