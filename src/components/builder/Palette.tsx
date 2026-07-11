import { useEffect, useRef } from "react";
import { useDraggable } from "@dnd-kit/core";
import * as LucideIcons from "lucide-react";
import { FIELD_TYPE_LIST, type FieldType } from "../../lib/form-schema";

function IconRenderer({ name }: { name: string }) {
  const Icon = (LucideIcons as any)[name];
  if (!Icon) return null;
  return <Icon className="h-4 w-4" />;
}

function PaletteChip({
  type,
  label,
  icon,
  comingSoon,
  onAdd,
}: {
  type: FieldType;
  label: string;
  icon: string;
  comingSoon?: boolean;
  onAdd: (type: FieldType) => void;
}) {
  const wasDragging = useRef(false);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${type}`,
    data: { source: "palette", fieldType: type },
    disabled: !!comingSoon,
  });

  useEffect(() => {
    if (isDragging) wasDragging.current = true;
  }, [isDragging]);

  return (
    <button
      ref={setNodeRef}
      type="button"
      {...(comingSoon ? {} : listeners)}
      {...(comingSoon ? {} : attributes)}
      disabled={comingSoon}
      onClick={() => {
        if (comingSoon) return;
        // Suppress the click that fires after a completed drag (would double-add).
        if (wasDragging.current) {
          wasDragging.current = false;
          return;
        }
        onAdd(type);
      }}
      title={comingSoon ? "Coming soon" : `Add ${label}`}
      className={[
        "flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-start text-sm font-medium shadow-sm transition",
        comingSoon
          ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400"
          : "cursor-grab border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50 active:cursor-grabbing",
        isDragging ? "opacity-40" : "",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-6 w-6 items-center justify-center rounded-md text-slate-500",
          comingSoon ? "bg-slate-100" : "bg-slate-100",
        ].join(" ")}
      >
        <IconRenderer name={icon} />
      </span>
      <span className="flex-1">{label}</span>
      {comingSoon && (
        <span className="rounded-md bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
          Soon
        </span>
      )}
    </button>
  );
}

interface PaletteProps {
  onAdd: (type: FieldType) => void;
}

export default function Palette({ onAdd }: PaletteProps) {
  const available = FIELD_TYPE_LIST.filter((m) => !m.comingSoon);
  const soon = FIELD_TYPE_LIST.filter((m) => m.comingSoon);

  return (
    <div className="space-y-2">
      <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Drag or tap to add
      </p>
      {available.map((meta) => (
        <PaletteChip
          key={meta.type}
          type={meta.type}
          label={meta.label}
          icon={meta.icon}
          onAdd={onAdd}
        />
      ))}
      {soon.length > 0 && (
        <>
          <p className="px-1 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Coming soon
          </p>
          {soon.map((meta) => (
            <PaletteChip
              key={meta.type}
              type={meta.type}
              label={meta.label}
              icon={meta.icon}
              comingSoon
              onAdd={onAdd}
            />
          ))}
        </>
      )}
    </div>
  );
}
