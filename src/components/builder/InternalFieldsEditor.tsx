import type { InternalFieldConfig, InternalFieldType } from "../../lib/form-schema";

const fid = () => Math.random().toString(36).slice(2, 10);

const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400";
const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

interface InternalFieldsEditorProps {
  fields: InternalFieldConfig[];
  onChange: (next: InternalFieldConfig[]) => void;
}

export default function InternalFieldsEditor({ fields, onChange }: InternalFieldsEditorProps) {
  const add = (type: InternalFieldType) => {
    const next: InternalFieldConfig = {
      id: fid(),
      type,
      label: type === "select" ? "Status" : "Notes",
      options: type === "select" ? ["New", "In progress", "Done"] : undefined,
    };
    onChange([...fields, next]);
  };

  const update = (id: string, patch: Partial<InternalFieldConfig>) => {
    onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const remove = (id: string) => {
    onChange(fields.filter((f) => f.id !== id));
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Admin-only columns on responses. Not shown on the public form.
      </p>

      {fields.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
          No internal fields yet
        </p>
      )}

      {fields.map((f, index) => (
        <div key={f.id} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-2">
            <select
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-600"
              value={f.type}
              onChange={(e) => {
                const type = e.target.value as InternalFieldType;
                update(f.id, {
                  type,
                  options: type === "select" ? f.options ?? ["Option 1", "Option 2"] : undefined,
                });
              }}
            >
              <option value="text">Text</option>
              <option value="select">Select</option>
            </select>
            <div className="ms-auto flex gap-1">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                className="rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-white disabled:opacity-30"
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === fields.length - 1}
                className="rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-white disabled:opacity-30"
                aria-label="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => remove(f.id)}
                className="rounded px-1.5 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                Remove
              </button>
            </div>
          </div>

          <div>
            <label className={labelCls}>Label</label>
            <input
              className={inputCls}
              value={f.label}
              onChange={(e) => update(f.id, { label: e.target.value })}
              placeholder="Field label"
            />
          </div>

          {f.type === "select" && (
            <div className="space-y-1.5">
              <label className={labelCls}>Options</label>
              {(f.options ?? []).map((opt, oi) => (
                <div key={oi} className="flex gap-1">
                  <input
                    className={inputCls}
                    value={opt}
                    onChange={(e) => {
                      const options = [...(f.options ?? [])];
                      options[oi] = e.target.value;
                      update(f.id, { options });
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const options = (f.options ?? []).filter((_, i) => i !== oi);
                      if (options.length === 0) return;
                      update(f.id, { options });
                    }}
                    className="rounded-lg px-2 text-xs text-slate-400 hover:bg-white hover:text-red-600"
                    aria-label="Remove option"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  update(f.id, {
                    options: [...(f.options ?? []), `Option ${(f.options?.length ?? 0) + 1}`],
                  })
                }
                className="text-xs font-semibold text-brand-600 hover:underline"
              >
                + Add option
              </button>
            </div>
          )}
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => add("text")}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          + Text
        </button>
        <button
          type="button"
          onClick={() => add("select")}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          + Select
        </button>
      </div>
    </div>
  );
}
