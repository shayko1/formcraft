import {
  DEFAULT_THEME,
  isDarkCardBackground,
  type FieldConfig,
  type FormTheme,
} from "../../lib/form-schema";

/** Resolve explicit field dir, else form theme dir. */
function resolveDir(field: FieldConfig, theme: FormTheme): "rtl" | "ltr" {
  if (field.dir === "rtl" || field.dir === "ltr") return field.dir;
  return theme.dir ?? DEFAULT_THEME.dir;
}

function RequiredMark() {
  return (
    <span className="ms-1 text-red-500" aria-hidden>
      *
    </span>
  );
}

/** Live-looking field chrome for the canvas editor (non-interactive). */
export default function FieldPreview({
  field,
  theme,
}: {
  field: FieldConfig;
  theme: FormTheme;
}) {
  const accent = theme.accent || DEFAULT_THEME.accent;
  const dark = isDarkCardBackground(theme);
  // Match FormRenderer: labels follow form direction; inputs follow field override.
  const labelDir = theme.dir ?? DEFAULT_THEME.dir;
  const valueDir = resolveDir(field, theme);
  const labelColor = field.style?.labelColor || (dark ? "#e2e8f0" : "#334155");
  const labelSize = field.style?.labelSize ?? (field.type === "heading" ? 28 : 13);
  const textColor = field.style?.textColor || (dark ? "#f8fafc" : "#0f172a");
  const fontSize = field.style?.fontSize ?? 14;

  if (field.type === "heading") {
    return (
      <div
        dir={labelDir}
        className="flex h-full w-full items-center text-start font-extrabold leading-tight"
        style={{ color: labelColor, fontSize: labelSize }}
      >
        {field.label || "Heading"}
      </div>
    );
  }

  if (field.type === "image") {
    return (
      <div
        dir={labelDir}
        className="flex h-full w-full items-center justify-center overflow-hidden rounded-md bg-slate-100"
      >
        {field.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={field.src}
            alt={field.label || "Image"}
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <span className="text-xs text-slate-400">Add image URL in settings</span>
        )}
      </div>
    );
  }

  const inputCls =
    "pointer-events-none w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-start text-slate-700";

  return (
    <div dir={labelDir} className="space-y-1 text-start" style={{ color: textColor, fontSize }}>
      <div className="font-semibold text-start" style={{ color: labelColor, fontSize: labelSize }}>
        {field.label || "Untitled"}
        {field.required && <RequiredMark />}
      </div>

      {field.type === "textarea" ? (
        <div dir={valueDir} className={`${inputCls} min-h-[56px] text-slate-400`}>
          {field.placeholder || " "}
        </div>
      ) : field.type === "select" ? (
        <div dir={valueDir} className={`${inputCls} flex items-center justify-between text-slate-400`}>
          <span className="min-w-0 flex-1 truncate text-start">
            {field.placeholder || "Choose…"}
          </span>
          <span className="ms-2 shrink-0" aria-hidden>
            ▾
          </span>
        </div>
      ) : field.type === "radio" ? (
        <div className="space-y-1" dir={labelDir}>
          {(field.options ?? ["Option"]).slice(0, 4).map((o) => (
            <div key={o} className="flex items-center gap-1.5 text-start text-xs text-slate-600">
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-full border-2"
                style={{ borderColor: accent }}
              />
              <span className="min-w-0 text-start">{o}</span>
            </div>
          ))}
        </div>
      ) : field.type === "checkbox" ? (
        <div className="space-y-1" dir={labelDir}>
          {(field.options ?? ["Option"]).slice(0, 4).map((o) => (
            <div key={o} className="flex items-center gap-1.5 text-start text-xs text-slate-600">
              <span
                className="inline-block h-3 w-3 shrink-0 rounded border-2"
                style={{ borderColor: accent }}
              />
              <span className="min-w-0 text-start">{o}</span>
            </div>
          ))}
        </div>
      ) : field.type === "file" ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-2 py-3 text-center text-xs text-slate-400">
          Click to upload a file
        </div>
      ) : (
        <div dir={valueDir} className={`${inputCls} text-slate-400`}>
          {field.placeholder || " "}
        </div>
      )}

      {field.helpText && (
        <p className="text-start text-[10px] text-slate-400">{field.helpText}</p>
      )}
    </div>
  );
}
