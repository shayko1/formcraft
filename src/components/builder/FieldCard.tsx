import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FIELD_TYPES, type FieldConfig, type FormTheme } from "../../lib/form-schema";
import { Icon } from "../icons";

/** Floating preview while dragging — no useSortable (must not share field ids). */
export function FieldDragPreview({
  field,
  themeDir = "ltr",
}: {
  field: FieldConfig;
  themeDir?: FormTheme["dir"];
}) {
  const meta = FIELD_TYPES[field.type] ?? FIELD_TYPES.text;
  return (
    <div
      dir="ltr"
      className="flex w-[360px] max-w-[90vw] cursor-grabbing items-center gap-3 rounded-xl border border-brand-400 bg-white p-3 shadow-2xl ring-2 ring-brand-100"
    >
      <span className="flex h-8 w-6 shrink-0 items-center justify-center text-slate-400">
        <Icon name="GripVertical" />
      </span>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
        <Icon name={meta.icon} />
      </span>
      <div dir={themeDir} className="min-w-0 flex-1 text-start">
        <div className="truncate text-sm font-semibold text-slate-800">
          {field.label || "Untitled"}
        </div>
        <div className="truncate text-xs text-slate-400" style={{ unicodeBidi: "plaintext" }}>
          {meta.label}
        </div>
      </div>
    </div>
  );
}

interface FieldCardProps {
  field: FieldConfig;
  selected: boolean;
  enableDrag?: boolean;
  index: number;
  total: number;
  themeDir?: FormTheme["dir"];
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
  themeDir = "ltr",
  onSelect,
  onDelete,
  onDuplicate,
  onMove,
}: FieldCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
    disabled: !enableDrag,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const meta = FIELD_TYPES[field.type] ?? FIELD_TYPES.text;

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      // Keep editor chrome LTR (grip / actions). Only the question label follows form dir.
      dir="ltr"
      className={[
        "group flex items-center gap-3 rounded-xl border bg-white p-3 shadow-sm transition",
        enableDrag ? "cursor-grab active:cursor-grabbing" : "",
        isDragging
          ? "z-10 border-brand-300 bg-brand-50/50 shadow-md"
          : selected
            ? "border-brand-400 ring-2 ring-brand-200"
            : "border-slate-200 hover:border-slate-300",
      ].join(" ")}
      {...(enableDrag ? listeners : {})}
      {...(enableDrag ? attributes : {})}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      {enableDrag ? (
        <span
          aria-hidden
          className="flex h-9 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 group-hover:bg-slate-50 group-hover:text-slate-600"
        >
          <Icon name="GripVertical" />
        </span>
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
            <Icon name="ChevronUp" className="h-4 w-4" />
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
            <Icon name="ChevronDown" className="h-4 w-4" />
          </button>
        </div>
      )}

      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
        <Icon name={meta.icon} />
      </span>

      <div dir={themeDir} className="min-w-0 flex-1 text-start">
        <div className="truncate text-sm font-semibold text-slate-800">
          {field.label || <span className="text-slate-400">Untitled</span>}
          {field.required && (
            <span className="ms-1 text-red-500" aria-hidden>
              *
            </span>
          )}
        </div>
        <div className="truncate text-xs text-slate-400" style={{ unicodeBidi: "plaintext" }}>
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
        onPointerDown={(e) => e.stopPropagation()}
        aria-label="Duplicate field"
        title="Duplicate"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-brand-50 hover:text-brand-600 lg:opacity-0 lg:group-hover:opacity-100 lg:focus:opacity-100"
      >
        <Icon name="Copy" />
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label="Delete field"
        title="Delete"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-500 lg:opacity-0 lg:group-hover:opacity-100 lg:focus:opacity-100"
      >
        <Icon name="X" />
      </button>
    </div>
  );
}
