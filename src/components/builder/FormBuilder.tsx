import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import * as LucideIcons from "lucide-react";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  FIELD_TYPES,
  DEFAULT_THEME,
  PAGE_BACKGROUNDS,
  CARD_STYLES,
  CARD_BACKGROUNDS,
  resolvePageBackground,
  resolveCardAppearance,
  ensureCanvasLayouts,
  type FieldConfig,
  type FieldLayout,
  type FieldType,
  type FormTheme,
  type InternalFieldConfig,
  type LayoutMode,
  type PageBackgroundPreset,
  type CardStyle,
} from "../../lib/form-schema";
import { nextDropLayout } from "../../lib/canvas-snap";
import Palette from "./Palette";
import CanvasEditor from "./CanvasEditor";
import FieldCard, { FieldDragPreview } from "./FieldCard";
import SettingsPanel from "./SettingsPanel";
import InternalFieldsEditor from "./InternalFieldsEditor";
import FormRenderer from "../FormRenderer";

function IconRenderer({ name, className }: { name: string; className?: string }) {
  const Icon = (LucideIcons as any)[name];
  if (!Icon) return null;
  return <Icon className={className || "h-4 w-4"} />;
}

interface FormBuilderProps {
  formId: string;
  slug: string;
  initialTitle: string;
  initialDescription: string;
  initialFields: FieldConfig[];
  initialInternalFields?: InternalFieldConfig[];
  initialTheme: FormTheme;
  initialPublished: boolean;
  initialLiveVersion?: number | null;
  origin: string;
}

const fid = () => Math.random().toString(36).slice(2, 10);

function makeField(type: FieldType): FieldConfig {
  return { id: fid(), type, ...FIELD_TYPES[type].defaults() };
}

const ACCENTS = [
  "#4f46e5",
  "#2563eb",
  "#059669",
  "#db2777",
  "#ea580c",
  "#0891b2",
  "#7c3aed",
  "#dc2626",
];

type Tab = "build" | "settings" | "design" | "preview";
type RightPane = "edit" | "live";

export default function FormBuilder(props: FormBuilderProps) {
  const [title, setTitle] = useState(props.initialTitle);
  const [description, setDescription] = useState(props.initialDescription);
  const initialMode: LayoutMode =
    props.initialTheme?.layoutMode === "stack" || props.initialTheme?.layoutMode === "canvas"
      ? props.initialTheme.layoutMode
      : props.initialFields?.some((f) => f.layout != null)
        ? "canvas"
        : "stack";
  const [fields, setFields] = useState<FieldConfig[]>(() =>
    initialMode === "canvas" ? ensureCanvasLayouts(props.initialFields) : props.initialFields ?? [],
  );
  const [internalFields, setInternalFields] = useState<InternalFieldConfig[]>(
    props.initialInternalFields ?? [],
  );
  const [theme, setTheme] = useState<FormTheme>({
    ...DEFAULT_THEME,
    ...(props.initialTheme ?? {}),
    layoutMode: initialMode,
  });
  const [published, setPublished] = useState(props.initialPublished);
  const [liveVersion, setLiveVersion] = useState<number | null>(props.initialLiveVersion ?? null);
  const [selectedId, setSelectedId] = useState<string | null>(
    props.initialFields[0]?.id ?? null,
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [showPublish, setShowPublish] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<
    { id: string; version: number; title: string; createdDate: string; isLive?: boolean }[]
  >([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("build");
  const [rightPane, setRightPane] = useState<RightPane>("edit");
  const [fullPreview, setFullPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);

  const savedSnapshot = useRef("");
  const isCanvas = theme.layoutMode === "canvas";

  const draftSnapshot = () =>
    JSON.stringify({ title, description, fields, internalFields, theme });

  // Baseline = loaded draft (no autosave).
  useEffect(() => {
    savedSnapshot.current = draftSnapshot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setDirty(draftSnapshot() !== savedSnapshot.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, fields, internalFields, theme]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const apply = () => setIsNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // Higher distance so light finger pans scroll instead of starting a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 12 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const selected = fields.find((f) => f.id === selectedId) ?? null;
  const publicUrl = `${props.origin}/f/${props.slug}`;
  const draggingField = activeId ? fields.find((f) => f.id === activeId) : null;

  // Keyboard: Delete/Backspace removes selected field when not typing in an input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selectedId) return;
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.target as HTMLElement)?.isContentEditable) return;
      e.preventDefault();
      deleteField(selectedId);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Lock document scroll — editor uses a fixed inset shell that fills the host iframe.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      htmlHeight: html.style.height,
      bodyHeight: body.style.height,
      htmlOverscroll: html.style.overscrollBehavior,
      bodyOverscroll: body.style.overscrollBehavior,
    };
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    html.style.height = "100%";
    body.style.height = "100%";
    html.style.overscrollBehavior = "none";
    body.style.overscrollBehavior = "none";
    return () => {
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      html.style.height = prev.htmlHeight;
      body.style.height = prev.bodyHeight;
      html.style.overscrollBehavior = prev.htmlOverscroll;
      body.style.overscrollBehavior = prev.bodyOverscroll;
    };
  }, []);

  async function persist() {
    setSave("saving");
    try {
      const res = await fetch(`/api/forms/${props.formId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          fields,
          internalFields,
          theme,
        }),
      });
      if (res.ok) {
        savedSnapshot.current = draftSnapshot();
        setDirty(false);
        setSave("saved");
      } else {
        setSave("error");
      }
    } catch {
      setSave("error");
    }
  }

  async function handlePublish() {
    if (dirty) {
      const ok = window.confirm("Save draft and publish this version to the live link?");
      if (!ok) return;
    } else {
      const ok = window.confirm(
        published
          ? "Publish this draft to the live link? Visitors will see these changes."
          : "Publish this form? It will be available at your public link.",
      );
      if (!ok) return;
    }
    setSave("saving");
    try {
      const res = await fetch(`/api/forms/${props.formId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          fields,
          internalFields,
          theme,
        }),
      });
      if (!res.ok) {
        setSave("error");
        return;
      }
      const body = (await res.json()) as { version?: number };
      setPublished(true);
      setLiveVersion(body.version ?? null);
      savedSnapshot.current = draftSnapshot();
      setDirty(false);
      setSave("saved");
      setShowPublish(true);
    } catch {
      setSave("error");
    }
  }

  async function openVersions() {
    setShowVersions(true);
    setVersionsLoading(true);
    try {
      const res = await fetch(`/api/forms/${props.formId}/versions`);
      if (!res.ok) {
        setVersions([]);
        return;
      }
      const body = (await res.json()) as {
        versions: typeof versions;
        liveVersion: number | null;
      };
      setVersions(body.versions ?? []);
      if (body.liveVersion != null) setLiveVersion(body.liveVersion);
    } catch {
      setVersions([]);
    } finally {
      setVersionsLoading(false);
    }
  }

  async function restoreVersion(versionId: string) {
    if (dirty) {
      const ok = window.confirm(
        "You have unsaved changes. Restore this version into the draft anyway? Unsaved edits will be lost.",
      );
      if (!ok) return;
    } else {
      const ok = window.confirm(
        "Restore this version into the editor as a draft? The live form will not change until you Publish.",
      );
      if (!ok) return;
    }
    setSave("saving");
    try {
      const res = await fetch(`/api/forms/${props.formId}/versions/${versionId}/restore`, {
        method: "POST",
      });
      if (!res.ok) {
        setSave("error");
        return;
      }
      const body = (await res.json()) as {
        title: string;
        description: string;
        fields: FieldConfig[];
        theme: FormTheme;
      };
      const nextTheme = { ...DEFAULT_THEME, ...body.theme };
      const nextFields =
        nextTheme.layoutMode === "canvas" || body.fields.some((f) => f.layout)
          ? ensureCanvasLayouts(body.fields)
          : body.fields;
      setTitle(body.title);
      setDescription(body.description);
      setFields(nextFields);
      setTheme(nextTheme);
      savedSnapshot.current = JSON.stringify({
        title: body.title,
        description: body.description,
        fields: nextFields,
        internalFields,
        theme: nextTheme,
      });
      setDirty(false);
      setSave("saved");
      setShowVersions(false);
      setTab("build");
    } catch {
      setSave("error");
    }
  }

  /** Canvas: stay on Build. Simple list: jump to Settings on mobile. */
  const selectField = (id: string | null) => {
    setSelectedId(id);
    if (!id) return;
    setRightPane("edit");
    if (
      theme.layoutMode !== "canvas" &&
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 1023px)").matches
    ) {
      setTab("settings");
    }
  };

  const openFieldSettings = (id: string) => {
    setSelectedId(id);
    setRightPane("edit");
    setTab("settings");
  };

  const setLayoutMode = (mode: LayoutMode) => {
    setTheme((t) => ({ ...t, layoutMode: mode }));
    if (mode === "canvas") {
      setFields((prev) => ensureCanvasLayouts(prev));
    }
  };

  const moveField = (id: string, dir: -1 | 1) => {
    setFields((prev) => {
      const oldIdx = prev.findIndex((f) => f.id === id);
      if (oldIdx === -1) return prev;
      const newIdx = oldIdx + dir;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      return arrayMove(prev, oldIdx, newIdx);
    });
  };

  const addField = (type: FieldType) => {
    if (FIELD_TYPES[type]?.comingSoon) return;
    setFields((prev) => {
      const base = makeField(type);
      const f: FieldConfig =
        theme.layoutMode === "canvas"
          ? { ...base, layout: base.layout ?? nextDropLayout(prev, type) }
          : base;
      setTimeout(() => selectField(f.id), 0);
      return [...prev, f];
    });
  };

  const updateSelected = (patch: Partial<FieldConfig>) => {
    if (!selectedId) return;
    setFields((prev) => prev.map((f) => (f.id === selectedId ? { ...f, ...patch } : f)));
  };

  const updateLayout = (id: string, layout: FieldLayout) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, layout } : f)));
  };

  const deleteField = (id: string) => {
    setFields((prev) => {
      const next = prev.filter((f) => f.id !== id);
      if (selectedId === id) {
        const idx = prev.findIndex((f) => f.id === id);
        const neighbor = next[Math.min(idx, next.length - 1)] ?? null;
        setSelectedId(neighbor?.id ?? null);
      }
      return next;
    });
  };

  const duplicateField = (id: string) => {
    setFields((prev) => {
      const idx = prev.findIndex((f) => f.id === id);
      if (idx === -1) return prev;
      const src = prev[idx]!;
      const copy: FieldConfig = {
        ...src,
        id: fid(),
        label: `${src.label} (copy)`,
        options: src.options ? [...src.options] : undefined,
        style: src.style ? { ...src.style } : undefined,
        layout:
          theme.layoutMode === "canvas"
            ? src.layout
              ? { ...src.layout, x: src.layout.x + 24, y: src.layout.y + 24, z: (src.layout.z ?? 1) + 1 }
              : nextDropLayout(prev, src.type)
            : undefined,
      };
      if (theme.layoutMode === "canvas") {
        setTimeout(() => selectField(copy.id), 0);
        return [...prev, copy];
      }
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      setTimeout(() => selectField(copy.id), 0);
      return next;
    });
  };

  const bringForward = (id: string) => {
    setFields((prev) => {
      const maxZ = prev.reduce((m, f) => Math.max(m, f.layout?.z ?? 0), 0);
      return prev.map((f) =>
        f.id === id && f.layout ? { ...f, layout: { ...f.layout, z: maxZ + 1 } } : f,
      );
    });
  };

  const sendBackward = (id: string) => {
    setFields((prev) => {
      const minZ = prev.reduce((m, f) => Math.min(m, f.layout?.z ?? 0), Infinity);
      const nextZ = Number.isFinite(minZ) ? minZ - 1 : 0;
      return prev.map((f) =>
        f.id === id && f.layout ? { ...f, layout: { ...f.layout, z: nextZ } } : f,
      );
    });
  };

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;

    if (active.data.current?.source === "palette") {
      const type = active.data.current.fieldType as FieldType;
      if (FIELD_TYPES[type]?.comingSoon) return;
      setFields((prev) => {
        const base = makeField(type);
        const nf: FieldConfig =
          theme.layoutMode === "canvas"
            ? { ...base, layout: base.layout ?? nextDropLayout(prev, type) }
            : base;
        if (theme.layoutMode === "canvas") {
          setTimeout(() => selectField(nf.id), 0);
          return [...prev, nf];
        }
        const overIdx = prev.findIndex((f) => f.id === over.id);
        const idx = overIdx === -1 ? prev.length : overIdx;
        const next = [...prev];
        next.splice(idx, 0, nf);
        setTimeout(() => selectField(nf.id), 0);
        return next;
      });
      return;
    }

    // Simple list reorder
    if (theme.layoutMode !== "canvas" && String(active.id) !== String(over.id)) {
      setFields((prev) => {
        const oldIdx = prev.findIndex((f) => f.id === active.id);
        if (oldIdx === -1) return prev;
        if (over.id === "canvas") {
          return arrayMove(prev, oldIdx, prev.length - 1);
        }
        const newIdx = prev.findIndex((f) => f.id === over.id);
        return newIdx === -1 ? prev : arrayMove(prev, oldIdx, newIdx);
      });
    }
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  const saveLabel =
    save === "saving"
      ? "Saving…"
      : save === "error"
        ? "Save failed"
        : dirty
          ? "Unsaved changes"
          : save === "saved"
            ? published
              ? liveVersion
                ? `Draft saved · live v${liveVersion}`
                : "Draft saved"
              : "Draft saved"
            : published
              ? liveVersion
                ? `Live v${liveVersion}`
                : "Published"
              : "Draft";

  const tabs: { id: Tab; label: string }[] = [
    { id: "build", label: "Build" },
    { id: "settings", label: "Settings" },
    { id: "design", label: "Design" },
    { id: "preview", label: "Preview" },
  ];

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      {/* Fill the visible host frame (not 100dvh — that overshoots the Wix iframe). */}
      <div className="fixed inset-0 z-0 flex flex-col overflow-hidden bg-slate-100">
      {/* Top bar — stays visible */}
      <div className="z-30 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <a
            href="/dashboard"
            onClick={(e) => {
              if (!dirty) return;
              if (!window.confirm("You have unsaved changes. Leave without saving?")) {
                e.preventDefault();
              }
            }}
            className="shrink-0 rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
          >
            <IconRenderer name="ArrowLeft" />
          </a>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled form"
            aria-label="Form title"
            dir="auto"
            className="min-w-0 flex-1 rounded-lg px-2 py-1 text-base font-bold text-slate-900 outline-none hover:bg-slate-50 focus:bg-slate-50 sm:text-lg"
          />
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <span
            className={[
              "hidden text-xs sm:inline",
              dirty ? "font-semibold text-amber-600" : "text-slate-400",
            ].join(" ")}
            aria-live="polite"
          >
            {saveLabel}
          </span>
          <button
            type="button"
            onClick={() => void persist()}
            disabled={save === "saving"}
            className={[
              "rounded-lg border px-2.5 py-1.5 text-sm font-semibold sm:px-3",
              dirty
                ? "border-brand-400 bg-brand-50 text-brand-700"
                : "border-slate-200 text-slate-700 hover:bg-slate-50",
            ].join(" ")}
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => void openVersions()}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            title="Published version history — restore into draft"
          >
            Versions
          </button>
          <button
            type="button"
            onClick={() => setFullPreview((v) => !v)}
            className={[
              "hidden rounded-lg border px-3 py-1.5 text-sm font-semibold transition lg:inline-flex",
              fullPreview
                ? "border-brand-400 bg-brand-50 text-brand-700"
                : "border-slate-200 text-slate-700 hover:bg-slate-50",
            ].join(" ")}
          >
            {fullPreview ? "Back to editor" : "Preview"}
          </button>
          <a
            href={`/dashboard/forms/${props.formId}/submissions`}
            title="Responses"
            aria-label="Responses"
            onClick={(e) => {
              if (!dirty) return;
              if (!window.confirm("You have unsaved changes. Leave without saving?")) {
                e.preventDefault();
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:px-3"
          >
            <IconRenderer name="Inbox" className="h-4 w-4" />
            <span className="hidden sm:inline">Responses</span>
          </a>
          <button
            type="button"
            onClick={() => void handlePublish()}
            disabled={save === "saving"}
            className="rounded-lg bg-grad-brand px-3 py-1.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90 sm:px-4"
          >
            Publish
          </button>
          {published && (
            <button
              type="button"
              onClick={() => setShowPublish(true)}
              className="hidden rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:inline-flex"
            >
              Link
            </button>
          )}
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="z-20 flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 lg:hidden">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setFullPreview(false);
              setTab(t.id);
            }}
            className={[
              "shrink-0 px-3 py-2 text-sm font-semibold capitalize transition",
              tab === t.id
                ? "border-b-2 border-brand-600 text-brand-600"
                : "text-slate-500",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Desktop full preview — real form width, no builder chrome */}
      {fullPreview ? (
        <div
          className={[
            "hidden min-h-0 flex-1 overflow-y-auto p-6 lg:block",
            resolvePageBackground(theme).bodyClass,
          ].join(" ")}
          style={resolvePageBackground(theme).style as React.CSSProperties | undefined}
        >
          <div
            className={["mx-auto max-w-lg", resolveCardAppearance(theme).className].join(" ")}
            style={resolveCardAppearance(theme).style as React.CSSProperties}
          >
            <FormRenderer
              formId={props.formId}
              title={title}
              description={description}
              fields={fields}
              theme={theme}
              preview
            />
          </div>
        </div>
      ) : (
      <div
        className="grid min-h-0 w-full min-w-0 flex-1 grid-cols-1 gap-4 overflow-y-auto overscroll-y-contain p-3 sm:p-4 lg:grid-cols-[220px_minmax(0,1fr)_320px] lg:grid-rows-1 lg:gap-4 lg:overflow-hidden lg:p-4"
        style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
      >
        {/* Desktop palette — independent scroll */}
        <aside className="hidden min-h-0 min-w-0 overflow-y-auto overscroll-contain lg:block">
          <Palette onAdd={addField} />
        </aside>

        {/* Canvas column */}
        <main
          className={[
            "min-h-0 min-w-0",
            tab === "build"
              ? "flex min-h-full flex-col lg:h-full lg:overflow-hidden"
              : "hidden lg:flex lg:h-full lg:flex-col lg:overflow-hidden",
          ].join(" ")}
        >
          <div className="mb-3 w-full min-w-0 shrink-0 lg:hidden">
            <Palette onAdd={addField} layout="strip" />
          </div>
          <div className="mb-3 shrink-0 rounded-xl border border-slate-200 bg-white p-4">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Form description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional subtitle shown above the form"
              dir="auto"
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>

          {/* Layout mode switcher */}
          <div className="mb-3 flex shrink-0 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
            {(
              [
                {
                  id: "stack" as const,
                  label: "Simple form",
                  hint: "Stacked fields · theme controls design",
                  icon: "Rows3",
                },
                {
                  id: "canvas" as const,
                  label: "Freeform",
                  hint: "Drag anywhere · overlap · images",
                  icon: "Move",
                },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setLayoutMode(m.id)}
                className={[
                  "flex flex-1 flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-start transition",
                  theme.layoutMode === m.id
                    ? "bg-white text-brand-700 shadow-sm ring-1 ring-brand-200"
                    : "text-slate-500 hover:text-slate-700",
                ].join(" ")}
              >
                <span className="flex items-center gap-1.5 text-xs font-bold">
                  <IconRenderer name={m.icon} className="h-3.5 w-3.5" />
                  {m.label}
                </span>
                <span className="hidden text-[10px] font-medium text-slate-400 sm:block">{m.hint}</span>
              </button>
            ))}
          </div>

          {/* Canvas area — tall enough on mobile; parent grid scrolls */}
          <div className="min-h-[55vh] flex-1 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain">
            {isCanvas ? (
              <CanvasEditor
                fields={fields}
                selectedId={selectedId}
                theme={theme}
                onSelect={selectField}
                onUpdateLayout={updateLayout}
                onDelete={deleteField}
                onDuplicate={duplicateField}
                onBringForward={bringForward}
                onSendBackward={sendBackward}
                onEditSettings={openFieldSettings}
              />
            ) : (
            <StackCanvas
              fields={fields}
              selectedId={selectedId}
              enableDrag={!isNarrow}
              themeDir={theme.dir}
              onSelect={(id) => selectField(id)}
              onDelete={deleteField}
              onDuplicate={duplicateField}
              onMove={moveField}
            />
            )}
          </div>
        </main>

        {/* Right column — scrolls on its own; canvas column does not move */}
        <aside
          className={[
            "min-h-0 min-w-0 space-y-3 overflow-y-auto overscroll-contain",
            tab === "build"
              ? "hidden lg:block lg:h-full"
              : "block min-h-full lg:h-full",
          ].join(" ")}
          style={
            tab !== "build"
              ? { WebkitOverflowScrolling: "touch", touchAction: "pan-y" }
              : undefined
          }
        >
          {/* Mobile: keep a peek of the form while editing settings */}
          {(tab === "settings" || tab === "design") && (
            <div className="sticky top-0 z-10 -mx-1 mb-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm lg:hidden">
              <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Form preview
                </p>
                <button
                  type="button"
                  onClick={() => setTab("build")}
                  className="text-[11px] font-bold text-brand-600"
                >
                  Edit canvas
                </button>
              </div>
              <div
                className={[
                  "max-h-36 overflow-hidden rounded-lg p-2",
                  resolvePageBackground(theme).bodyClass,
                ].join(" ")}
                style={resolvePageBackground(theme).style as React.CSSProperties | undefined}
              >
                <div
                  className={resolveCardAppearance(theme)
                    .className.replace("sm:p-8", "p-3")
                    .replace("p-6", "p-3")
                    .replace("rounded-3xl", "rounded-xl")}
                  style={resolveCardAppearance(theme).style as React.CSSProperties}
                >
                  <div className="pointer-events-none origin-top scale-[0.85]">
                    <FormRenderer
                      formId={props.formId}
                      title={title}
                      description={description}
                      fields={fields}
                      theme={theme}
                      preview
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className="hidden gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 lg:flex">
            {(
              [
                { id: "edit", label: "Edit" },
                { id: "live", label: "Live" },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setRightPane(p.id)}
                className={[
                  "flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition",
                  rightPane === p.id
                    ? "bg-white text-brand-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-700",
                ].join(" ")}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Edit pane: settings + design */}
          <div
            className={[
              "space-y-4",
              tab === "settings" || tab === "design" ? "block" : "hidden",
              rightPane === "edit" ? "lg:block" : "lg:hidden",
            ].join(" ")}
          >
            <div className={tab === "settings" ? "block" : "hidden lg:block"}>
              <button
                type="button"
                onClick={() => setTab("build")}
                className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 lg:hidden"
              >
                <IconRenderer name="ArrowLeft" className="h-4 w-4" />
                Fields
              </button>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Field settings
                </p>
                <SettingsPanel field={selected} formId={props.formId} onChange={updateSelected} />
              </div>
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Internal fields
                </p>
                <InternalFieldsEditor fields={internalFields} onChange={setInternalFields} />
              </div>
            </div>

            <div className={tab === "design" ? "block" : "hidden lg:block"}>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Builder mode
                </p>
                <div className="mb-4 flex gap-2">
                  {(
                    [
                      { id: "stack" as const, label: "Simple form" },
                      { id: "canvas" as const, label: "Freeform" },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setLayoutMode(m.id)}
                      className={[
                        "flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition",
                        theme.layoutMode === m.id
                          ? "border-brand-400 bg-brand-50 text-brand-700"
                          : "border-slate-200 text-slate-500 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <p className="mb-3 text-[11px] leading-relaxed text-slate-400">
                  {isCanvas
                    ? "Freeform: place fields anywhere, overlap, images, and per-field text style."
                    : "Simple form: vertical list. Control look with accent, background, and card style below."}
                </p>

                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Accent color
                </p>
                <div className="flex flex-wrap gap-2">
                  {ACCENTS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setTheme((t) => ({ ...t, accent: c }))}
                      aria-label={`Accent ${c}`}
                      className={[
                        "h-7 w-7 rounded-full ring-2 ring-offset-2 transition",
                        theme.accent === c ? "ring-slate-400" : "ring-transparent",
                      ].join(" ")}
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Direction
                </p>
                <div className="flex gap-2">
                  {(["rtl", "ltr"] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setTheme((t) => ({ ...t, dir: d }))}
                      className={[
                        "flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold uppercase transition",
                        theme.dir === d
                          ? "border-brand-400 bg-brand-50 text-brand-700"
                          : "border-slate-200 text-slate-500 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      {d}
                    </button>
                  ))}
                </div>

                <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Version history
                </p>
                <p className="mb-2 text-xs text-slate-500">
                  Each Publish creates a snapshot (last 10). Restore loads it into the draft — Publish again to go live.
                </p>
                <button
                  type="button"
                  onClick={() => void openVersions()}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Manage versions
                </button>

                <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Submit button
                </p>
                <input
                  value={theme.submitLabel ?? ""}
                  onChange={(e) => setTheme((t) => ({ ...t, submitLabel: e.target.value }))}
                  placeholder={DEFAULT_THEME.submitLabel}
                  dir="auto"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                />

                <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Thank-you title
                </p>
                <input
                  value={theme.thankYouTitle ?? ""}
                  onChange={(e) => setTheme((t) => ({ ...t, thankYouTitle: e.target.value }))}
                  placeholder={DEFAULT_THEME.thankYouTitle}
                  dir="auto"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                />

                <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Thank-you message
                </p>
                <textarea
                  value={theme.thankYouMessage ?? ""}
                  onChange={(e) => setTheme((t) => ({ ...t, thankYouMessage: e.target.value }))}
                  placeholder={DEFAULT_THEME.thankYouMessage}
                  rows={2}
                  dir="auto"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                />

                <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Submission rules
                </p>

                <label className="flex items-center justify-between gap-3 rounded-lg border border-brand-200 bg-brand-50/40 px-3 py-2.5">
                  <span>
                    <span className="block text-sm font-medium text-slate-700">
                      Allow duplicate field values
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      Turns off all “Require unique value” checks for this form. Per-field unique
                      settings are in Field settings (select a field).
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={!!theme.allowDuplicateResponses}
                    onChange={(e) =>
                      setTheme((t) => ({ ...t, allowDuplicateResponses: e.target.checked }))
                    }
                    className="h-4 w-4 shrink-0 accent-brand-600"
                  />
                </label>

                <label className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
                  <span>
                    <span className="block text-sm font-medium text-slate-700">
                      Allow adding another response
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-400">
                      Different: shows “+ add another” so one person can fill the form multiple
                      times on the same page
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={!!theme.allowMultipleEntries}
                    onChange={(e) =>
                      setTheme((t) => ({ ...t, allowMultipleEntries: e.target.checked }))
                    }
                    className="h-4 w-4 shrink-0 accent-brand-600"
                  />
                </label>
                {theme.allowMultipleEntries && (
                  <>
                    <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Add-button label
                    </p>
                    <input
                      value={theme.addEntryLabel ?? ""}
                      onChange={(e) =>
                        setTheme((t) => ({ ...t, addEntryLabel: e.target.value }))
                      }
                      placeholder={DEFAULT_THEME.addEntryLabel}
                      dir="auto"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                    />
                  </>
                )}

                <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Page background
                </p>
                <div className="flex flex-wrap gap-2">
                  {PAGE_BACKGROUNDS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      title={p.label}
                      aria-label={p.label}
                      onClick={() =>
                        setTheme((t) => ({
                          ...t,
                          pageBackground: p.id as PageBackgroundPreset,
                        }))
                      }
                      className={[
                        "h-8 w-8 rounded-full ring-2 ring-offset-2 transition",
                        (theme.pageBackground ?? "slate") === p.id
                          ? "ring-slate-400"
                          : "ring-transparent",
                      ].join(" ")}
                      style={{
                        background:
                          p.id === "brand"
                            ? `color-mix(in srgb, ${theme.accent || DEFAULT_THEME.accent} 35%, white)`
                            : p.swatch,
                      }}
                    />
                  ))}
                </div>

                <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Form card background
                </p>
                <p className="mb-2 text-[11px] text-slate-400">
                  The form itself (the card around your fields)
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {CARD_BACKGROUNDS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      title={c.label}
                      aria-label={c.label}
                      onClick={() => setTheme((t) => ({ ...t, cardBackground: c.color }))}
                      className={[
                        "h-8 w-8 rounded-full border border-slate-200 ring-2 ring-offset-2 transition",
                        (theme.cardBackground || "#ffffff").toLowerCase() === c.color.toLowerCase()
                          ? "ring-slate-400"
                          : "ring-transparent",
                      ].join(" ")}
                      style={{ background: c.color }}
                    />
                  ))}
                  <label className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-500">
                    <input
                      type="color"
                      value={theme.cardBackground || "#ffffff"}
                      onChange={(e) =>
                        setTheme((t) => ({ ...t, cardBackground: e.target.value }))
                      }
                      className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
                      aria-label="Custom form card color"
                    />
                    Custom
                  </label>
                </div>

                <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Card style
                </p>
                <div className="flex gap-2">
                  {CARD_STYLES.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() =>
                        setTheme((t) => ({ ...t, cardStyle: c.id as CardStyle }))
                      }
                      className={[
                        "flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition",
                        (theme.cardStyle ?? "elevated") === c.id
                          ? "border-brand-400 bg-brand-50 text-brand-700"
                          : "border-slate-200 text-slate-500 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Live pane (desktop) + mobile Preview tab */}
          <div
            className={[
              "min-w-0 overflow-x-hidden",
              tab === "preview" ? "block" : "hidden",
              rightPane === "live" ? "lg:block" : "lg:hidden",
            ].join(" ")}
          >
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Live preview
                </p>
                <button
                  type="button"
                  onClick={() => setFullPreview(true)}
                  className="hidden text-xs font-semibold text-brand-600 hover:text-brand-700 lg:inline"
                >
                  Full preview
                </button>
              </div>
              <div
                className={[
                  "rounded-xl p-3",
                  resolvePageBackground(theme).bodyClass,
                ].join(" ")}
                style={
                  resolvePageBackground(theme).style as React.CSSProperties | undefined
                }
              >
                <div
                  className={resolveCardAppearance(theme)
                    .className.replace("sm:p-8", "sm:p-4")
                    .replace("p-6", "p-4")}
                  style={resolveCardAppearance(theme).style as React.CSSProperties}
                >
                  <FormRenderer
                    formId={props.formId}
                    title={title}
                    description={description}
                    fields={fields}
                    theme={theme}
                    preview
                  />
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
      )}

      <DragOverlay dropAnimation={null}>
        {activeId && activeId.startsWith("palette:") ? (
          <div className="rounded-xl border border-brand-300 bg-white px-3 py-2.5 text-sm font-semibold text-brand-700 shadow-xl">
            {FIELD_TYPES[activeId.replace("palette:", "") as FieldType]?.label}
          </div>
        ) : draggingField ? (
          <FieldDragPreview field={draggingField} themeDir={theme.dir} />
        ) : null}
      </DragOverlay>

      {showPublish && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setShowPublish(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
              <IconRenderer name="PartyPopper" className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-extrabold text-slate-900">Published!</h3>
            <p className="mt-1 text-sm text-slate-500">
              {liveVersion ? `Version ${liveVersion} is live. ` : ""}
              Share this link to collect responses. Draft edits stay private until you Publish again.
              Use <strong>Versions</strong> in the top bar to restore an older publish into the draft.
            </p>
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
              <input
                readOnly
                value={publicUrl}
                className="min-w-0 flex-1 bg-transparent px-2 text-sm text-slate-700 outline-none"
              />
              <button
                type="button"
                onClick={copyUrl}
                className="rounded-lg bg-grad-brand px-3 py-1.5 text-sm font-semibold text-white"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Open form
              </a>
              <button
                type="button"
                onClick={() => setShowPublish(false)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {showVersions && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setShowVersions(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">Versions</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Last 10 publishes. Restore loads into draft only.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowVersions(false)}
                className="rounded-lg px-2 py-1 text-sm font-medium text-slate-500 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3">
              {versionsLoading ? (
                <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
              ) : versions.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">
                  No published versions yet. Publish to create the first snapshot.
                </p>
              ) : (
                <ul className="space-y-2">
                  {versions.map((v) => (
                    <li
                      key={v.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800">
                          v{v.version}
                          {v.isLive && (
                            <span className="ms-2 rounded-md bg-green-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-700">
                              Live
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-slate-400">
                          {v.title || "Untitled"}
                          {v.createdDate
                            ? ` · ${new Date(v.createdDate).toLocaleString()}`
                            : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void restoreVersion(v.id)}
                        className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Restore
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </DndContext>
  );
}

function StackCanvas({
  fields,
  selectedId,
  enableDrag,
  themeDir = "ltr",
  onSelect,
  onDelete,
  onDuplicate,
  onMove,
}: {
  fields: FieldConfig[];
  selectedId: string | null;
  enableDrag: boolean;
  themeDir?: FormTheme["dir"];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas" });

  return (
    <div
      ref={setNodeRef}
      className={[
        "min-h-[280px] min-w-0 rounded-2xl border-2 border-dashed p-3 transition sm:min-h-[400px] sm:p-4",
        isOver ? "border-brand-400 bg-brand-50/50" : "border-slate-200 bg-white",
      ].join(" ")}
    >
      {fields.length === 0 ? (
        <div className="flex h-72 flex-col items-center justify-center text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <IconRenderer name="Magnet" className="h-8 w-8" />
          </span>
          <p className="mt-3 font-semibold text-slate-600">Add your first field</p>
          <p className="mt-1 text-sm text-slate-400 lg:hidden">Tap a field type above to add it</p>
          <p className="mt-1 hidden text-sm text-slate-400 lg:block">
            Drag a field here, or tap a type on the left
          </p>
        </div>
      ) : (
        <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2.5">
            {fields.map((f, i) => (
              <FieldCard
                key={f.id}
                field={f}
                selected={f.id === selectedId}
                enableDrag={enableDrag}
                index={i}
                total={fields.length}
                themeDir={themeDir}
                onSelect={() => onSelect(f.id)}
                onDelete={() => onDelete(f.id)}
                onDuplicate={() => onDuplicate(f.id)}
                onMove={(dir) => onMove(f.id, dir)}
              />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
}
