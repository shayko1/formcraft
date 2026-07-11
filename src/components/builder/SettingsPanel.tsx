import { FIELD_TYPES, type FieldConfig } from "../../lib/form-schema";

interface SettingsPanelProps {
  field: FieldConfig | null;
  onChange: (patch: Partial<FieldConfig>) => void;
}

const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400";
const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

export default function SettingsPanel({ field, onChange }: SettingsPanelProps) {
  if (!field) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 p-8 text-center">
        <span className="text-3xl">🎛️</span>
        <p className="mt-2 text-sm text-slate-400">Select a field to edit its settings</p>
      </div>
    );
  }

  const meta = FIELD_TYPES[field.type];

  const setOptions = (text: string) =>
    onChange({ options: text.split("\n").map((s) => s.trim()).filter(Boolean) });

  return (
    <div className="space-y-4">
      <div>
        <label className={labelCls}>Label</label>
        <input
          className={inputCls}
          value={field.label}
          onChange={(e) => onChange({ label: e.target.value })}
        />
      </div>

      {meta.hasPlaceholder && (
        <div>
          <label className={labelCls}>Placeholder</label>
          <input
            className={inputCls}
            value={field.placeholder ?? ""}
            onChange={(e) => onChange({ placeholder: e.target.value })}
          />
        </div>
      )}

      {meta.hasOptions && (
        <div>
          <label className={labelCls}>Options (one per line)</label>
          <textarea
            className={inputCls}
            rows={4}
            value={(field.options ?? []).join("\n")}
            onChange={(e) => setOptions(e.target.value)}
          />
        </div>
      )}

      <div>
        <label className={labelCls}>Text direction</label>
        <div className="flex gap-2">
          {(["auto", "rtl", "ltr"] as const).map((d) => (
            <button
              key={d}
              onClick={() => onChange({ dir: d })}
              className={[
                "flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold uppercase transition",
                (field.dir ?? "auto") === d
                  ? "border-brand-400 bg-brand-50 text-brand-700"
                  : "border-slate-200 text-slate-500 hover:bg-slate-50",
              ].join(" ")}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5">
        <span className="text-sm font-medium text-slate-700">Required field</span>
        <input
          type="checkbox"
          checked={field.required}
          onChange={(e) => onChange({ required: e.target.checked })}
          className="h-4 w-4 accent-brand-600"
        />
      </label>
    </div>
  );
}
