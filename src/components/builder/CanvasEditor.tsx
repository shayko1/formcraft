import { useDroppable } from "@dnd-kit/core";
import { useCallback, useEffect, useRef, useState } from "react";
import * as LucideIcons from "lucide-react";
import {
  DEFAULT_CANVAS_WIDTH,
  DEFAULT_THEME,
  FIELD_TYPES,
  isDarkCardBackground,
  resolveFieldBackground,
  type FieldConfig,
  type FieldLayout,
  type FormTheme,
} from "../../lib/form-schema";
import { canvasHeight, snapPosition, type GuideLine } from "../../lib/canvas-snap";
import FieldPreview from "./FieldPreview";

function Icon({ name, className }: { name: string; className?: string }) {
  const C = (LucideIcons as any)[name];
  if (!C) return null;
  return <C className={className || "h-4 w-4"} />;
}

interface CanvasEditorProps {
  fields: FieldConfig[];
  selectedId: string | null;
  theme: FormTheme;
  onSelect: (id: string | null) => void;
  onUpdateLayout: (id: string, layout: FieldLayout) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onBringForward: (id: string) => void;
  onSendBackward: (id: string) => void;
  /** Jump to field settings (mobile Edit button). */
  onEditSettings?: (id: string) => void;
}

type DragMode = "move" | "resize";

export default function CanvasEditor({
  fields,
  selectedId,
  theme,
  onSelect,
  onUpdateLayout,
  onDelete,
  onDuplicate,
  onBringForward,
  onSendBackward,
  onEditSettings,
}: CanvasEditorProps) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas" });
  const viewportRef = useRef<HTMLDivElement>(null);
  const [guides, setGuides] = useState<GuideLine[]>([]);
  const [scale, setScale] = useState(1);
  const scaleRef = useRef(1);
  const dragRef = useRef<{
    id: string;
    mode: DragMode;
    startX: number;
    startY: number;
    orig: FieldLayout;
    pointerId: number;
    moved: boolean;
  } | null>(null);

  const artboardW = theme.canvasWidth ?? DEFAULT_CANVAS_WIDTH;
  const height = canvasHeight(fields, 520);
  const accent = theme.accent || "#4f46e5";
  const cardBg = theme.cardBackground || DEFAULT_THEME.cardBackground || "#ffffff";
  const darkCard = isDarkCardBackground(theme);
  const gridLine = darkCard ? "rgb(255 255 255 / 0.08)" : "rgb(15 23 42 / 0.06)";

  // Scale artboard to fit phone / narrow columns — layout stays in design px.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => {
      const pad = 8;
      const avail = Math.max(200, el.clientWidth - pad);
      const next = Math.min(1, avail / artboardW);
      scaleRef.current = next;
      setScale(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [artboardW]);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      e.preventDefault();
      const s = scaleRef.current || 1;
      const rawDx = e.clientX - drag.startX;
      const rawDy = e.clientY - drag.startY;
      // Ignore tiny finger jitter so a tap doesn't nudge the field
      if (!drag.moved && Math.hypot(rawDx, rawDy) < 8) return;
      drag.moved = true;
      const dx = rawDx / s;
      const dy = rawDy / s;
      const siblings = fields
        .filter((f) => f.id !== drag.id && f.layout)
        .map((f) => f.layout!);

      if (drag.mode === "move") {
        const snapped = snapPosition(
          drag.orig,
          drag.orig.x + dx,
          drag.orig.y + dy,
          siblings,
          artboardW,
        );
        setGuides(snapped.guides);
        onUpdateLayout(drag.id, { ...drag.orig, x: snapped.x, y: snapped.y });
      } else {
        const w = Math.max(120, Math.round((drag.orig.w + dx) / 8) * 8);
        const h = Math.max(48, Math.round(((drag.orig.h ?? 72) + dy) / 8) * 8);
        setGuides([]);
        onUpdateLayout(drag.id, { ...drag.orig, w, h });
      }
    },
    [artboardW, fields, onUpdateLayout],
  );

  const endDrag = useCallback(() => {
    dragRef.current = null;
    setGuides([]);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
    document.body.style.overflow = "";
    document.body.style.touchAction = "";
  }, [onPointerMove]);

  const startDrag = (id: string, mode: DragMode, e: React.PointerEvent) => {
    const field = fields.find((f) => f.id === id);
    if (!field?.layout) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect(id);
    dragRef.current = {
      id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      orig: { ...field.layout },
      pointerId: e.pointerId,
      moved: false,
    };
    // Lock page scroll while dragging on mobile
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
  };

  const sorted = [...fields].sort(
    (a, b) => (a.layout?.z ?? 0) - (b.layout?.z ?? 0),
  );
  const selected = fields.find((f) => f.id === selectedId) ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {/* Desktop toolbar */}
      <div className="hidden shrink-0 flex-wrap items-center gap-2 text-xs text-slate-500 sm:flex">
        <span className="rounded-md bg-slate-100 px-2 py-1 font-medium">
          Freeform canvas · snap on · scales to screen
        </span>
        {selectedId && (
          <>
            <button
              type="button"
              onClick={() => onBringForward(selectedId)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 font-semibold hover:bg-slate-50"
            >
              <Icon name="BringToFront" className="h-3.5 w-3.5" /> Front
            </button>
            <button
              type="button"
              onClick={() => onSendBackward(selectedId)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 font-semibold hover:bg-slate-50"
            >
              <Icon name="SendToBack" className="h-3.5 w-3.5" /> Back
            </button>
            <button
              type="button"
              onClick={() => onDuplicate(selectedId)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 font-semibold hover:bg-slate-50"
            >
              <Icon name="Copy" className="h-3.5 w-3.5" /> Duplicate
            </button>
            <button
              type="button"
              onClick={() => onDelete(selectedId)}
              className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2 py-1.5 font-semibold text-red-600 hover:bg-red-50"
            >
              <Icon name="Trash2" className="h-3.5 w-3.5" /> Delete
            </button>
          </>
        )}
      </div>

      <p className="shrink-0 px-0.5 text-xs text-slate-500 sm:hidden">
        Tap a field · use Move handle to drag · scroll the board
      </p>

      <div
        ref={(node) => {
          setNodeRef(node);
          (viewportRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        className={[
          "min-h-[320px] flex-1 overflow-x-hidden overflow-y-auto overscroll-contain rounded-2xl border-2 border-dashed p-2 transition sm:min-h-[360px] sm:p-3",
          isOver ? "border-brand-400 bg-brand-50/40" : "border-slate-200 bg-slate-100/80",
        ].join(" ")}
        style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
        onClick={() => onSelect(null)}
      >
        {/* Outer box holds scaled visual size so scroll height is correct */}
        <div
          className="relative mx-auto"
          style={{
            width: artboardW * scale,
            height: height * scale,
          }}
        >
          {/* Physical left + origin-top-left so scale matches stored layout.x even when
              the artboard content is dir=rtl (logical start would pin to the right). */}
          <div
            className={[
              "absolute left-0 top-0 origin-top-left shadow-xl shadow-slate-900/5 ring-1",
              darkCard ? "ring-white/10" : "ring-slate-200",
            ].join(" ")}
            dir={theme.dir ?? "ltr"}
            style={{
              width: artboardW,
              minHeight: height,
              transform: `scale(${scale})`,
              backgroundColor: cardBg,
              backgroundImage: `linear-gradient(to right, ${gridLine} 1px, transparent 1px), linear-gradient(to bottom, ${gridLine} 1px, transparent 1px)`,
              backgroundSize: "8px 8px",
            }}
          >
            {fields.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                <span
                  className={[
                    "flex h-14 w-14 items-center justify-center rounded-full",
                    darkCard ? "bg-white/10 text-slate-300" : "bg-slate-100 text-slate-400",
                  ].join(" ")}
                >
                  <Icon name="MousePointer2" className="h-7 w-7" />
                </span>
                <p
                  className={[
                    "mt-3 font-semibold",
                    darkCard ? "text-slate-100" : "text-slate-600",
                  ].join(" ")}
                >
                  Add fields to your form
                </p>
                <p
                  className={[
                    "mt-1 max-w-xs text-sm",
                    darkCard ? "text-slate-400" : "text-slate-400",
                  ].join(" ")}
                >
                  Tap a type above, then drag on the canvas. Works on phone and desktop.
                </p>
              </div>
            )}

            {sorted.map((f) => {
              const layout = f.layout;
              if (!layout) return null;
              const isSel = f.id === selectedId;
              const meta = FIELD_TYPES[f.type] ?? FIELD_TYPES.text;
              const fieldBg = resolveFieldBackground(f.style, {
                darkCard,
                defaultChrome: true,
              });
              return (
                <div
                  key={f.id}
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(f.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(f.id);
                    }
                  }}
                  className="absolute rounded-lg"
                  style={{
                    left: layout.x,
                    top: layout.y,
                    width: layout.w,
                    height: layout.h,
                    zIndex: layout.z + (isSel ? 1000 : 0),
                    boxShadow: isSel ? `0 0 0 2px ${accent}` : undefined,
                  }}
                >
                  {/* Always-visible drag handle on mobile when selected */}
                  <div
                    onPointerDown={(e) => {
                      // Drag only from handle — rest of card allows scroll on mobile
                      startDrag(f.id, "move", e);
                    }}
                    className={[
                      "absolute -top-7 start-0 z-10 flex h-7 touch-none items-center gap-1 rounded-t-md px-2 text-[11px] font-bold text-white",
                      isSel ? "opacity-100" : "pointer-events-none opacity-0",
                    ].join(" ")}
                    style={{ background: accent, touchAction: "none" }}
                  >
                    <Icon name="GripHorizontal" className="h-3.5 w-3.5" />
                    Move
                    <span className="hidden font-medium opacity-80 sm:inline">· {meta.label}</span>
                  </div>

                  <div
                    className={[
                      "h-full w-full overflow-hidden rounded-lg p-2",
                      fieldBg.className,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={{
                      ...(fieldBg.backgroundColor
                        ? { backgroundColor: fieldBg.backgroundColor }
                        : {}),
                    }}
                  >
                    <FieldPreview field={f} theme={theme} />
                  </div>

                  {isSel && (
                    <div
                      onPointerDown={(e) => startDrag(f.id, "resize", e)}
                      className="absolute -bottom-2 -end-2 z-10 flex h-10 w-10 touch-none items-center justify-center"
                      style={{ touchAction: "none" }}
                      title="Resize"
                      aria-label="Resize"
                    >
                      <span
                        className="h-5 w-5 rounded-md border-2 border-white shadow-md"
                        style={{ background: accent }}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {guides.map((g, i) =>
              g.orientation === "v" ? (
                <div
                  key={`v-${i}-${g.pos}`}
                  className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-pink-500"
                  style={{ left: g.pos }}
                />
              ) : (
                <div
                  key={`h-${i}-${g.pos}`}
                  className="pointer-events-none absolute start-0 end-0 h-0.5 bg-pink-500"
                  style={{ top: g.pos }}
                />
              ),
            )}
          </div>
        </div>
      </div>

      {/* Mobile sticky action bar — stay on Build tab while editing layout */}
      {selected && (
        <div className="sticky bottom-2 z-20 flex gap-1.5 rounded-2xl border border-slate-200 bg-white/95 p-1.5 shadow-lg backdrop-blur sm:hidden">
          <button
            type="button"
            onClick={() => onEditSettings?.(selected.id)}
            className="flex flex-1 flex-col items-center gap-0.5 rounded-xl bg-brand-50 px-2 py-2 text-[11px] font-bold text-brand-700"
          >
            <Icon name="Settings2" className="h-4 w-4" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => onBringForward(selected.id)}
            className="flex flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            <Icon name="BringToFront" className="h-4 w-4" />
            Front
          </button>
          <button
            type="button"
            onClick={() => onSendBackward(selected.id)}
            className="flex flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            <Icon name="SendToBack" className="h-4 w-4" />
            Back
          </button>
          <button
            type="button"
            onClick={() => onDuplicate(selected.id)}
            className="flex flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            <Icon name="Copy" className="h-4 w-4" />
            Copy
          </button>
          <button
            type="button"
            onClick={() => onDelete(selected.id)}
            className="flex flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[11px] font-semibold text-red-600 hover:bg-red-50"
          >
            <Icon name="Trash2" className="h-4 w-4" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
