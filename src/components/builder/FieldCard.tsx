import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as LucideIcons from "lucide-react";
import { FIELD_TYPES, type FieldConfig } from "../../lib/form-schema";

function IconRenderer({ name }: { name: string }) {
  const Icon = (LucideIcons as any)[name];
  if (!Icon) return null;
  return <Icon className="h-4 w-4" />;
}

interface FieldCardProps {
  field: FieldConfig;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export default function FieldCard({
  field,
  selected,
  onSelect,
  onDelete,
  onDuplicate,
}: FieldCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const meta = FIELD_TYPES[field.type] ?? FIELD_TYPES.text;

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={[
        "group flex items-center gap-3 rounded-xl border bg-white p-3 shadow-sm transition",
        selected ? "border-brand-400 ring-2 ring-brand-200" : "border-slate-200 hover:border-slate-300",
      ].join(" ")}
    >
      <button
        type="button"
        {...listeners}
        {...attributes}
        aria-label="Drag to reorder"
        onClick={(e) => e.stopPropagation()}
        className="flex h-8 w-6 shrink-0 cursor-grab items-center justify-center rounded text-slate-300 hover:text-slate-500 active:cursor-grabbing"
      >
        <IconRenderer name="GripVertical" />
      </button>

      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
        <IconRenderer name={meta.icon} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-800">
          {field.label || <span className="text-slate-400">Untitled</span>}
        </div>
        <div className="truncate text-xs text-slate-400">
          {meta.label}
          {field.required && " · required"}
          {field.helpText ? " · has help" : ""}
          {meta.hasOptions && field.options ? ` · ${field.options.length} options` : ""}
        </div>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDuplicate();
        }}
        aria-label="Duplicate field"
        title="Duplicate"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-300 opacity-0 transition hover:bg-brand-50 hover:text-brand-600 group-hover:opacity-100 focus:opacity-100"
      >
        <IconRenderer name="Copy" />
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label="Delete field"
        title="Delete"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 focus:opacity-100"
      >
        <IconRenderer name="X" />
      </button>
    </div>
  );
}
