import * as LucideIcons from "lucide-react";
import { FIELD_TYPES, type FieldConfig } from "../../lib/form-schema";

function IconRenderer({ name }: { name: string }) {
  const Icon = (LucideIcons as any)[name];
  if (!Icon) return null;
  return <Icon className="h-4 w-4" />;
}

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
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-2">
          <IconRenderer name="Settings2" />
        </span>
        <p className="mt-2 text-sm text-slate-400">Select a field to edit its settings</p>
      </div>
    );
  }

  const meta = FIELD_TYPES[field.type] ?? FIELD_TYPES.text;
  const options = field.options ?? [];

  const updateOption = (index: number, value: string) => {
    const next = [...options];
    next[index] = value;
    onChange({ options: next });
  };

  const addOption = () => {
    onChange({ options: [...options, `Option ${options.length + 1}`] });
  };

  const removeOption = (index: number) => {
    if (options.length <= 1) return;
    onChange({ options: options.filter((_, i) => i !== index) });
  };

  const moveOption = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= options.length) return;
    const next = [...options];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    onChange({ options: next });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white text-slate-500 shadow-sm">
          <IconRenderer name={meta.icon} />
        </span>
        {meta.label}
        {meta.comingSoon && <span className="text-amber-600">· coming soon</span>}
      </div>

      <div>
        <label className={labelCls}>Label</label>
        <input
          className={inputCls}
          value={field.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="Field label"
        />
      </div>

      {meta.hasPlaceholder && (
        <div>
          <label className={labelCls}>Placeholder</label>
          <input
            className={inputCls}
            value={field.placeholder ?? ""}
            onChange={(e) => onChange({ placeholder: e.target.value })}
            placeholder="Hint text inside the input"
          />
        </div>
      )}

      <div>
        <label className={labelCls}>Help text</label>
        <input
          className={inputCls}
          value={field.helpText ?? ""}
          onChange={(e) => onChange({ helpText: e.target.value })}
          placeholder="Optional hint below the field"
        />
      </div>

      {meta.hasOptions && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className={labelCls + " mb-0"}>Options</label>
            <button
              type="button"
              onClick={addOption}
              className="rounded-md px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50"
            >
              + Add
            </button>
          </div>
          <div className="space-y-1.5">
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-1">
                <input
                  className={inputCls}
                  value={opt}
                  onChange={(e) => updateOption(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                />
                <button
                  type="button"
                  aria-label="Move up"
                  disabled={i === 0}
                  onClick={() => moveOption(i, -1)}
                  className="flex h-8 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                >
                  <IconRenderer name="ArrowUp" />
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  disabled={i === options.length - 1}
                  onClick={() => moveOption(i, 1)}
                  className="flex h-8 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 disabled:opacity-30"
                >
                  <IconRenderer name="ArrowDown" />
                </button>
                <button
                  type="button"
                  aria-label="Remove option"
                  disabled={options.length <= 1}
                  onClick={() => removeOption(i)}
                  className="flex h-8 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
                >
                  <IconRenderer name="X" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {meta.hasMinMax && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>
              {field.type === "number" ? "Min value" : "Min length"}
            </label>
            <input
              type="number"
              className={inputCls}
              value={field.min ?? ""}
              onChange={(e) =>
                onChange({
                  min: e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
              placeholder="—"
            />
          </div>
          <div>
            <label className={labelCls}>
              {field.type === "number" ? "Max value" : "Max length"}
            </label>
            <input
              type="number"
              className={inputCls}
              value={field.max ?? ""}
              onChange={(e) =>
                onChange({
                  max: e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
              placeholder="—"
            />
          </div>
        </div>
      )}

      <div>
        <label className={labelCls}>Text direction</label>
        <div className="flex gap-2">
          {(["auto", "rtl", "ltr"] as const).map((d) => (
            <button
              key={d}
              type="button"
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
