import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
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
  resolvePageBackground,
  resolveCardClass,
  type FieldConfig,
  type FieldType,
  type FormTheme,
  type InternalFieldConfig,
  type PageBackgroundPreset,
  type CardStyle,
} from "../../lib/form-schema";
import Palette from "./Palette";
import FieldCard from "./FieldCard";
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
  const [fields, setFields] = useState<FieldConfig[]>(props.initialFields);
  const [internalFields, setInternalFields] = useState<InternalFieldConfig[]>(
    props.initialInternalFields ?? [],
  );
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
  const [rightPane, setRightPane] = useState<RightPane>("edit");
  const [fullPreview, setFullPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isNarrow, setIsNarrow] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches,
  );

  const firstRender = useRef(true);
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  // Desktop-only mouse drag. Mobile uses ↑↓ buttons — TouchSensor fights scroll/taps.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const sync = () => setIsNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

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
  }, [title, description, fields, internalFields, theme]);

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
        body: JSON.stringify({ title, description, fields, internalFields, theme, ...extra }),
      });
      setSave(res.ok ? "saved" : "error");
    } catch {
      setSave("error");
    }
  }

  const selectField = (id: string) => {
    setSelectedId(id);
    setRightPane("edit");
    // On narrow screens, jump to settings so the user can edit immediately.
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      setTab("settings");
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
      <div className="flex flex-wrap items-center justify-between gap-2 overflow-x-hidden border-b border-slate-200 bg-white px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <a
            href="/dashboard"
            className="shrink-0 rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
          >
            <IconRenderer name="ArrowLeft" />
          </a>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled form"
            aria-label="Form title"
            className="min-w-0 flex-1 rounded-lg px-2 py-1 text-base font-bold text-slate-900 outline-none hover:bg-slate-50 focus:bg-slate-50 sm:text-lg"
          />
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <span className="hidden text-xs text-slate-400 sm:inline" aria-live="polite">
            {saveLabel}
          </span>
          <button
            type="button"
            onClick={() => void persist()}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:px-3"
          >
            Save
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
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:px-3"
          >
            <IconRenderer name="Inbox" className="h-4 w-4" />
            <span className="hidden sm:inline">Responses</span>
          </a>
          <button
            type="button"
            onClick={handlePublish}
            className="rounded-lg bg-grad-brand px-3 py-1.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90 sm:px-4"
          >
            {published ? (
              <>
                <span className="sm:hidden">Link</span>
                <span className="hidden sm:inline">Published · Get link</span>
              </>
            ) : (
              "Publish"
            )}
          </button>
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 lg:hidden">
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
            "hidden min-h-[70vh] p-6 lg:block",
            resolvePageBackground(theme).bodyClass,
          ].join(" ")}
          style={resolvePageBackground(theme).style as React.CSSProperties | undefined}
        >
          <div className={["mx-auto max-w-lg", resolveCardClass(theme)].join(" ")}>
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
      <div className="grid min-w-0 gap-4 overflow-x-hidden p-3 sm:p-4 lg:grid-cols-[220px_minmax(0,1fr)_320px]">
        {/* Desktop palette — hidden on mobile (mobile uses strip above canvas) */}
        <aside className="hidden min-w-0 lg:block">
          <Palette onAdd={addField} />
        </aside>

        {/* Canvas (+ mobile field strip) */}
        <main className={["min-w-0", tab === "build" ? "block" : "hidden lg:block"].join(" ")}>
          <div className="mb-3 min-w-0 lg:hidden">
            <Palette onAdd={addField} layout="strip" />
          </div>
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
            enableDrag={!isNarrow}
            onSelect={selectField}
            onDelete={deleteField}
            onDuplicate={duplicateField}
            onMove={moveField}
          />
        </main>

        {/* Right column: Edit | Live tabs (desktop); mobile uses main tabs */}
        <aside
          className={[
            "min-w-0 space-y-3",
            tab === "build" ? "hidden lg:block" : "block",
          ].join(" ")}
        >
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
                <SettingsPanel field={selected} onChange={updateSelected} />
              </div>
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Internal fields
                </p>
                <InternalFieldsEditor fields={internalFields} onChange={setInternalFields} />
              </div>
              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Submission rules
                </p>
                <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
                  <span>
                    <span className="block text-sm font-medium text-slate-700">
                      Allow duplicate responses
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-400">
                      Same phone number can submit more than once
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
                      Public form can add multiple filled blocks before submit
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
                    <p className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Add-button label
                    </p>
                    <input
                      value={theme.addEntryLabel ?? ""}
                      onChange={(e) =>
                        setTheme((t) => ({ ...t, addEntryLabel: e.target.value }))
                      }
                      placeholder={DEFAULT_THEME.addEntryLabel}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                    />
                  </>
                )}
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
                <div className={resolveCardClass(theme).replace("sm:p-8", "sm:p-4").replace("p-6", "p-4")}>
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
  enableDrag,
  onSelect,
  onDelete,
  onDuplicate,
  onMove,
}: {
  fields: FieldConfig[];
  selectedId: string | null;
  enableDrag: boolean;
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
          <p className="mt-1 text-sm text-slate-400 lg:hidden">
            Tap a field type above to add it
          </p>
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
