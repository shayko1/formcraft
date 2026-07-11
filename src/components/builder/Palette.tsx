import { useDraggable } from "@dnd-kit/core";
import { FIELD_TYPE_LIST, type FieldType } from "../../lib/form-schema";

function PaletteChip({ type, label, icon }: { type: FieldType; label: string; icon: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${type}`,
    data: { source: "palette", fieldType: type },
  });
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={[
        "flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-start text-sm font-medium text-slate-700 shadow-sm transition",
        "cursor-grab hover:border-brand-300 hover:bg-brand-50 active:cursor-grabbing",
        isDragging ? "opacity-40" : "",
      ].join(" ")}
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-500">
        {icon}
      </span>
      {label}
    </button>
  );
}

interface PaletteProps {
  onAdd: (type: FieldType) => void;
}

export default function Palette({ onAdd }: PaletteProps) {
  return (
    <div className="space-y-2">
      <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Drag or tap to add
      </p>
      {FIELD_TYPE_LIST.map((meta) => (
        <div key={meta.type} onClick={() => onAdd(meta.type)}>
          <PaletteChip type={meta.type} label={meta.label} icon={meta.icon} />
        </div>
      ))}
    </div>
  );
}
