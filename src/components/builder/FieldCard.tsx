import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as LucideIcons from "lucide-react";
import { FIELD_TYPES, type FieldConfig } from "../../lib/form-schema";

function IconRenderer({ name, className }: { name: string; className?: string }) {
  const Icon = (LucideIcons as any)[name];
  if (!Icon) return null;
  return <Icon className={className || "h-4 w-4"} />;
}

interface FieldCardProps {
  field: FieldConfig;
  selected: boolean;
  /** Desktop drag-to-reorder. Off on mobile — use move buttons instead. */
  enableDrag?: boolean;
  index: number;
  total: number;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMove: (dir: -1 | 1) => void;
}

export default function FieldCard({
  field,
  selected,
  enableDrag = true,
  index,
  total,
  onSelect,
  onDelete,
  onDuplicate,
  onMove,
}: FieldCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
    disabled: !enableDrag,
  });

  const style = enableDrag
    ? {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

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
        "group flex max-w-full items-center gap-2 rounded-xl border bg-white p-3 shadow-sm transition sm:gap-3",
        selected ? "border-brand-400 ring-2 ring-brand-200" : "border-slate-200 hover:border-slate-300",
      ].join(" ")}
    >
      {enableDrag ? (
        <button
          type="button"
          {...listeners}
          {...attributes}
          aria-label="Drag to reorder"
          onClick={(e) => e.stopPropagation()}
          className="flex h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-slate-300 hover:text-slate-500 active:cursor-grabbing"
        >
          <IconRenderer name="GripVertical" />
        </button>
      ) : (
        <div className="flex shrink-0 flex-col gap-0.5">
          <button
            type="button"
            disabled={index === 0}
            aria-label="Move up"
            onClick={(e) => {
              e.stopPropagation();
              onMove(-1);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30"
          >
            <IconRenderer name="ChevronUp" className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={index >= total - 1}
            aria-label="Move down"
            onClick={(e) => {
              e.stopPropagation();
              onMove(1);
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30"
          >
            <IconRenderer name="ChevronDown" className="h-4 w-4" />
          </button>
        </div>
      )}

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
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-brand-50 hover:text-brand-600 lg:h-7 lg:w-7 lg:text-slate-300 lg:opacity-0 lg:group-hover:opacity-100 lg:focus:opacity-100"
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
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-500 lg:h-7 lg:w-7 lg:text-slate-300 lg:opacity-0 lg:group-hover:opacity-100 lg:focus:opacity-100"
      >
        <IconRenderer name="X" />
      </button>
    </div>
  );
}
