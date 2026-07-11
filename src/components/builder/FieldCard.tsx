import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FIELD_TYPES, type FieldConfig } from "../../lib/form-schema";

interface FieldCardProps {
  field: FieldConfig;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

export default function FieldCard({ field, selected, onSelect, onDelete }: FieldCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const meta = FIELD_TYPES[field.type];

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={[
        "group flex items-center gap-3 rounded-xl border bg-white p-3 shadow-sm transition",
        selected ? "border-brand-400 ring-2 ring-brand-200" : "border-slate-200 hover:border-slate-300",
      ].join(" ")}
    >
      <button
        {...listeners}
        {...attributes}
        aria-label="Drag to reorder"
        onClick={(e) => e.stopPropagation()}
        className="flex h-8 w-6 shrink-0 cursor-grab items-center justify-center rounded text-slate-300 hover:text-slate-500 active:cursor-grabbing"
      >
        ⋮⋮
      </button>

      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
        {meta.icon}
      </span>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-800">
          {field.label || <span className="text-slate-400">Untitled</span>}
        </div>
        <div className="text-xs text-slate-400">
          {meta.label}
          {field.required && " · required"}
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label="Delete field"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}
