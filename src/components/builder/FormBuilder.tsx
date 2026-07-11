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
  type FieldConfig,
  type FieldType,
  type FormTheme,
} from "../../lib/form-schema";
import Palette from "./Palette";
import FieldCard from "./FieldCard";
import SettingsPanel from "./SettingsPanel";
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
  initialTheme: FormTheme;
  initialPublished: boolean;
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

export default function FormBuilder(props: FormBuilderProps) {
  const [title, setTitle] = useState(props.initialTitle);
  const [description, setDescription] = useState(props.initialDescription);
  const [fields, setFields] = useState<FieldConfig[]>(props.initialFields);
  const [theme, setTheme] = useState<FormTheme>({
    ...DEFAULT_THEME,
    ...(props.initialTheme ?? {}),
  });
  const [published, setPublished] = useState(props.initialPublished);
  const [selectedId, setSelectedId] = useState<string | null>(
    props.initialFields[0]?.id ?? null,
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [showPublish, setShowPublish] = useState(false);
  const [tab, setTab] = useState<Tab>("build");
  const [copied, setCopied] = useState(false);

  const firstRender = useRef(true);
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const selected = fields.find((f) => f.id === selectedId) ?? null;
  const publicUrl = `${props.origin}/f/${props.slug}`;

  // Debounced autosave whenever the form content changes.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setSave("saving");
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => void persist(), 900);
    return () => clearTimeout(debounce.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, fields, theme]);

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

  async function persist(extra: Record<string, unknown> = {}) {
    try {
      const res = await fetch(`/api/forms/${props.formId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, fields, theme, ...extra }),
      });
      setSave(res.ok ? "saved" : "error");
    } catch {
      setSave("error");
    }
  }

  const selectField = (id: string) => {
    setSelectedId(id);
    // On narrow screens, jump to settings so the user can edit immediately.
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      setTab("settings");
    }
  };

  const addField = (type: FieldType) => {
    if (FIELD_TYPES[type]?.comingSoon) return;
    const f = makeField(type);
    setFields((prev) => [...prev, f]);
    selectField(f.id);
  };

  const updateSelected = (patch: Partial<FieldConfig>) => {
    if (!selectedId) return;
    setFields((prev) => prev.map((f) => (f.id === selectedId ? { ...f, ...patch } : f)));
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
      const src = prev[idx];
      const copy: FieldConfig = {
        ...src,
        id: fid(),
        label: `${src.label} (copy)`,
        options: src.options ? [...src.options] : undefined,
      };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      setTimeout(() => selectField(copy.id), 0);
      return next;
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
      const nf = makeField(type);
      setFields((prev) => {
        // Drop on a field → insert before it; drop on canvas / empty → append.
        const overIdx = prev.findIndex((f) => f.id === over.id);
        const idx = overIdx === -1 ? prev.length : overIdx;
        const next = [...prev];
        next.splice(idx, 0, nf);
        return next;
      });
      selectField(nf.id);
      return;
    }

    if (active.id !== over.id && over.id !== "canvas") {
      setFields((prev) => {
        const oldIdx = prev.findIndex((f) => f.id === active.id);
        const newIdx = prev.findIndex((f) => f.id === over.id);
        return oldIdx === -1 || newIdx === -1 ? prev : arrayMove(prev, oldIdx, newIdx);
      });
    }
  };

  async function handlePublish() {
    setPublished(true);
    await persist({ published: true });
    setShowPublish(true);
  }

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
      : save === "saved"
        ? "Saved ✓"
        : save === "error"
          ? "Save failed"
          : "";

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
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <a
            href="/dashboard"
            className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
          >
            <IconRenderer name="ArrowLeft" />
          </a>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled form"
            aria-label="Form title"
            className="min-w-0 flex-1 rounded-lg px-2 py-1 text-lg font-bold text-slate-900 outline-none hover:bg-slate-50 focus:bg-slate-50"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400" aria-live="polite">
            {saveLabel}
          </span>
          <button
            type="button"
            onClick={() => void persist()}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Save
          </button>
          <a
            href={`/dashboard/forms/${props.formId}/submissions`}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Responses
          </a>
          <button
            type="button"
            onClick={handlePublish}
            className="rounded-lg bg-grad-brand px-4 py-1.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90"
          >
            {published ? "Published · Get link" : "Publish"}
          </button>
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 lg:hidden">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
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

      <div className="grid gap-4 p-4 lg:grid-cols-[220px_minmax(0,1fr)_320px]">
        {/* Palette */}
        <aside className={tab === "build" ? "block" : "hidden lg:block"}>
          <Palette onAdd={addField} />
        </aside>

        {/* Canvas */}
        <main className={tab === "build" ? "block" : "hidden lg:block"}>
          <div className="mb-3 rounded-xl border border-slate-200 bg-white p-4">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Form description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional subtitle shown above the form"
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <Canvas
            fields={fields}
            selectedId={selectedId}
            onSelect={selectField}
            onDelete={deleteField}
            onDuplicate={duplicateField}
          />
        </main>

        {/* Settings + design + preview */}
        <aside className="space-y-4">
          <div className={tab === "settings" ? "block" : "hidden lg:block"}>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Field settings
              </p>
              <SettingsPanel field={selected} onChange={updateSelected} />
            </div>
          </div>

          <div className={tab === "design" ? "block" : "hidden lg:block"}>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
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
                Submit button
              </p>
              <input
                value={theme.submitLabel ?? ""}
                onChange={(e) => setTheme((t) => ({ ...t, submitLabel: e.target.value }))}
                placeholder={DEFAULT_THEME.submitLabel}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              />

              <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Thank-you title
              </p>
              <input
                value={theme.thankYouTitle ?? ""}
                onChange={(e) => setTheme((t) => ({ ...t, thankYouTitle: e.target.value }))}
                placeholder={DEFAULT_THEME.thankYouTitle}
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
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              />
            </div>
          </div>

          {/* Preview */}
          <div className={tab === "preview" ? "block" : "hidden lg:block"}>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Live preview
              </p>
              <div className="rounded-xl bg-white p-4 shadow-sm">
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
        </aside>
      </div>

      <DragOverlay>
        {activeId && activeId.startsWith("palette:") ? (
          <div className="rounded-xl border border-brand-300 bg-white px-3 py-2.5 text-sm font-medium text-brand-700 shadow-lg">
            {FIELD_TYPES[activeId.replace("palette:", "") as FieldType]?.label}
          </div>
        ) : activeId ? (
          <div className="rounded-xl border border-brand-300 bg-white p-3 text-sm font-semibold text-slate-800 shadow-lg">
            {fields.find((f) => f.id === activeId)?.label ?? "Field"}
          </div>
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
            <h3 className="mt-4 text-lg font-extrabold text-slate-900">Your form is live!</h3>
            <p className="mt-1 text-sm text-slate-500">
              Share this link to start collecting responses.
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
    </DndContext>
  );
}

function Canvas({
  fields,
  selectedId,
  onSelect,
  onDelete,
  onDuplicate,
}: {
  fields: FieldConfig[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas" });

  return (
    <div
      ref={setNodeRef}
      className={[
        "min-h-[400px] rounded-2xl border-2 border-dashed p-4 transition",
        isOver ? "border-brand-400 bg-brand-50/50" : "border-slate-200 bg-white",
      ].join(" ")}
    >
      {fields.length === 0 ? (
        <div className="flex h-72 flex-col items-center justify-center text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <IconRenderer name="Magnet" className="h-8 w-8" />
          </span>
          <p className="mt-3 font-semibold text-slate-600">Drag a field here</p>
          <p className="mt-1 text-sm text-slate-400">
            or tap a field type on the left to add it
          </p>
        </div>
      ) : (
        <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2.5">
            {fields.map((f) => (
              <FieldCard
                key={f.id}
                field={f}
                selected={f.id === selectedId}
                onSelect={() => onSelect(f.id)}
                onDelete={() => onDelete(f.id)}
                onDuplicate={() => onDuplicate(f.id)}
              />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
}
