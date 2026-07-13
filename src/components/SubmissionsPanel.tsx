import { useMemo, useState } from "react";
import {
  type FieldConfig,
  type InternalFieldConfig,
  isDecorativeField,
  isNameField,
  isPhoneField,
} from "../lib/form-schema";
import { parseUploadedFile, uploadedFileLabel } from "../lib/upload";
import SubmissionsInsights from "./SubmissionsInsights";

export interface SubmissionRow {
  id: string;
  data: Record<string, unknown>;
  exported: boolean;
  createdDate: string;
}

interface SubmissionsPanelProps {
  formId: string;
  fields: FieldConfig[];
  internalFields?: InternalFieldConfig[];
  submissions: SubmissionRow[];
  viewCount?: number;
  startCount?: number;
  /** All collected responses (may exceed visible rows on free plan). */
  totalResponses?: number;
}

type Filter = "all" | "new" | "exported";

function cellValue(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.join(", ");
  const file = parseUploadedFile(v);
  if (file) return uploadedFileLabel(file);
  return String(v);
}

function CellDisplay({ value }: { value: unknown }) {
  const file = parseUploadedFile(value);
  if (file) {
    return (
      <a
        href={file.url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-brand-primary underline"
        onClick={(e) => e.stopPropagation()}
      >
        {file.name}
      </a>
    );
  }
  const text = cellValue(value);
  return <>{text}</>;
}

// Generalized duplicate detection: group by normalized phone-like and name-like
// field values. First occurrence in each group is kept; the rest are duplicates.
function findDuplicateIds(fields: FieldConfig[], rows: SubmissionRow[]): Set<string> {
  const phoneFields = fields.filter(isPhoneField);
  const nameFields = fields.filter(isNameField);
  const groups = new Map<string, string[]>();

  const push = (key: string, id: string) => {
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(id);
  };

  for (const r of rows) {
    for (const pf of phoneFields) {
      const norm = cellValue(r.data[pf.id]).replace(/\D/g, "");
      if (norm) push(`p:${norm}`, r.id);
    }
    if (nameFields.length > 0) {
      const norm = nameFields
        .map((nf) => cellValue(r.data[nf.id]))
        .join("")
        .toLowerCase()
        .replace(/\s/g, "");
      if (norm) push(`n:${norm}`, r.id);
    }
  }

  const dupes = new Set<string>();
  for (const ids of groups.values()) {
    if (ids.length > 1) ids.slice(1).forEach((id) => dupes.add(id));
  }
  return dupes;
}

function answerFields(fields: FieldConfig[]): FieldConfig[] {
  return fields.filter((f) => !isDecorativeField(f.type));
}

function allExportColumnIds(fields: FieldConfig[], internalFields: InternalFieldConfig[]): string[] {
  return [
    ...answerFields(fields).map((f) => f.id),
    ...internalFields.map((f) => f.id),
    "_createdDate",
  ];
}

export default function SubmissionsPanel({
  formId,
  fields,
  internalFields = [],
  submissions,
  viewCount = 0,
  startCount = 0,
  totalResponses,
}: SubmissionsPanelProps) {
  const [rows, setRows] = useState<SubmissionRow[]>(submissions);
  const [collectedTotal, setCollectedTotal] = useState(totalResponses ?? submissions.length);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [exportIdsPending, setExportIdsPending] = useState<string[] | null>(null);
  const [exportColumns, setExportColumns] = useState<Set<string>>(
    () => new Set(allExportColumnIds(fields, internalFields)),
  );

  const [detailId, setDetailId] = useState<string | null>(null);
  const [draftInternal, setDraftInternal] = useState<Record<string, string>>({});
  const [detailSaving, setDetailSaving] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailSaved, setDetailSaved] = useState(false);

  const duplicateIds = useMemo(() => findDuplicateIds(fields, rows), [fields, rows]);

  const stats = {
    total: collectedTotal,
    fresh: rows.filter((r) => !r.exported).length,
    exported: rows.filter((r) => r.exported).length,
  };

  const filterBase =
    filter === "new" ? rows.filter((r) => !r.exported) :
    filter === "exported" ? rows.filter((r) => r.exported) : rows;

  const filtered = search
    ? filterBase.filter((r) => {
        const q = search.toLowerCase();
        return (
          answerFields(fields).some((f) => cellValue(r.data[f.id]).toLowerCase().includes(q)) ||
          internalFields.some((f) => cellValue(r.data[f.id]).toLowerCase().includes(q))
        );
      })
    : filterBase;

  const filteredIds = filtered.map((r) => r.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  const selectedInView = filteredIds.filter((id) => selected.has(id));

  const detailRow = detailId ? rows.find((r) => r.id === detailId) ?? null : null;

  const toggleAll = () =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (allSelected) filteredIds.forEach((id) => n.delete(id));
      else filteredIds.forEach((id) => n.add(id));
      return n;
    });

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const selectDuplicates = () => {
    setFilter("all");
    setSearch("");
    setSelected(new Set(duplicateIds));
  };

  const openDetail = (row: SubmissionRow) => {
    setDetailId(row.id);
    const draft: Record<string, string> = {};
    for (const f of internalFields) {
      draft[f.id] = cellValue(row.data[f.id]);
    }
    setDraftInternal(draft);
    setError(null);
    setDetailError(null);
    setDetailSaved(false);
  };

  const closeDetail = () => {
    setDetailId(null);
    setDraftInternal({});
    setDetailError(null);
    setDetailSaved(false);
  };

  const callApi = async (url: string, body: object) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let message = `Error ${res.status}`;
      try {
        const j = (await res.json()) as { message?: string };
        if (j.message) message = j.message;
      } catch {
        /* non-JSON error body */
      }
      throw new Error(message);
    }
    return res;
  };

  const openExportPicker = (ids: string[]) => {
    if (ids.length === 0) return;
    setExportColumns(new Set(allExportColumnIds(fields, internalFields)));
    setExportIdsPending(ids);
    setError(null);
  };

  const toggleExportColumn = (id: string) => {
    setExportColumns((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const confirmExport = async () => {
    if (!exportIdsPending || exportIdsPending.length === 0) return;
    if (exportColumns.size === 0) {
      setError("Select at least one column to export.");
      return;
    }
    const ids = exportIdsPending;
    setLoading(true);
    setError(null);
    try {
      const res = await callApi("/api/submissions/export", {
        formId,
        ids,
        fieldIds: [...exportColumns],
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href: url, download: `responses.csv` });
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      const idSet = new Set(ids);
      setRows((prev) => prev.map((r) => (idSet.has(r.id) ? { ...r, exported: true } : r)));
      setSelected(new Set());
      setExportIdsPending(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (selectedInView.length === 0) return;
    if (!window.confirm(`Delete ${selectedInView.length} response(s) permanently?`)) return;
    setLoading(true);
    setError(null);
    try {
      await callApi("/api/submissions/delete", { formId, ids: selectedInView });
      const removed = selectedInView.length;
      if (detailId && selectedInView.includes(detailId)) closeDetail();
      setRows((prev) => prev.filter((r) => !selectedInView.includes(r.id)));
      setCollectedTotal((n) => Math.max(0, n - removed));
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setLoading(false);
    }
  };

  const saveInternal = async () => {
    if (!detailRow) return;
    setDetailSaving(true);
    setDetailError(null);
    setDetailSaved(false);
    try {
      const res = await callApi("/api/submissions/update-internal", {
        formId,
        submissionId: detailRow.id,
        data: draftInternal,
      });
      const json = (await res.json()) as { data?: Record<string, unknown> };
      // Prefer draft for internal keys so the table updates even if the API payload is odd.
      const nextData = { ...detailRow.data, ...(json.data ?? {}), ...draftInternal };
      setRows((prev) =>
        prev.map((r) => (r.id === detailRow.id ? { ...r, data: nextData } : r)),
      );
      closeDetail();
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setDetailSaving(false);
    }
  };

  const filterBtn = (f: Filter, label: string) => (
    <button
      key={f}
      onClick={() => {
        setFilter(f);
        setSelected(new Set());
      }}
      className={[
        "rounded-lg px-3 py-1.5 text-sm font-medium transition",
        filter === f
          ? "bg-brand-primary text-white"
          : "bg-white text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50",
      ].join(" ")}
    >
      {label}
    </button>
  );

  // Image/heading are UI-only — never answer columns in the table or CSV.
  const dataFields = answerFields(fields);
  type TableCol = { id: string; label: string; dir?: FieldConfig["dir"]; internal?: boolean };
  const columns: TableCol[] = [
    ...dataFields.map((f) => ({ id: f.id, label: f.label, dir: f.dir })),
    ...internalFields.map((f) => ({ id: f.id, label: f.label, internal: true as const })),
  ];
  const exportColumnOptions = [
    ...dataFields.map((f) => ({ id: f.id, label: f.label })),
    ...internalFields.map((f) => ({ id: f.id, label: `${f.label} (internal)` })),
    { id: "_createdDate", label: "Submitted" },
  ];

  return (
    <div className="space-y-5">
      <SubmissionsInsights
        fields={fields}
        submissions={rows}
        viewCount={viewCount}
        startCount={startCount}
        totalResponses={stats.total}
        newCount={stats.fresh}
        exportedCount={stats.exported}
        duplicateCount={duplicateIds.size}
        onSelectDuplicates={selectDuplicates}
      />

      <div className="border-t border-slate-200 pt-5">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Responses</h2>
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setSelected(new Set());
        }}
        placeholder="Search responses…"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-primary/30"
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {filterBtn("all", "All")}
          {filterBtn("new", "New")}
          {filterBtn("exported", "Exported")}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => openExportPicker(filteredIds)}
            disabled={loading || filteredIds.length === 0}
            className="clay-btn-primary px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {loading ? "…" : `Export all (${filteredIds.length})`}
          </button>
          <button
            onClick={() => openExportPicker(selectedInView)}
            disabled={loading || selectedInView.length === 0}
            className="clay-btn-secondary px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {loading ? "…" : `Export selected (${selectedInView.length})`}
          </button>
          <button
            onClick={handleDelete}
            disabled={loading || selectedInView.length === 0}
            className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "…" : `Delete (${selectedInView.length})`}
          </button>
        </div>
      </div>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-2 py-2 text-start sm:px-3">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 accent-brand-primary" />
              </th>
              {columns.map((c, i) => (
                <th
                  key={c.id}
                  className={[
                    "px-2 py-2 text-start sm:px-3",
                    i > 1 ? "hidden md:table-cell" : "",
                    c.internal ? "text-slate-400" : "",
                  ].join(" ")}
                >
                  {c.label}
                  {c.internal && (
                    <span className="ms-1 hidden font-medium normal-case tracking-normal sm:inline">
                      (int.)
                    </span>
                  )}
                </th>
              ))}
              <th className="px-2 py-2 text-start sm:px-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={columns.length + 2} className="px-3 py-8 text-center text-slate-400">
                  No responses
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const isDupe = duplicateIds.has(r.id);
              return (
                <tr
                  key={r.id}
                  onClick={() => openDetail(r)}
                  className={[
                    "cursor-pointer transition",
                    detailId === r.id
                      ? "bg-brand-primary/10"
                      : selected.has(r.id)
                        ? "bg-brand-primary/5"
                        : isDupe
                          ? "bg-yellow-50 hover:bg-yellow-100"
                          : "hover:bg-slate-50",
                  ].join(" ")}
                >
                  <td className="px-2 py-2 sm:px-3">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggleOne(r.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 accent-brand-primary"
                    />
                  </td>
                  {columns.map((c, i) => (
                    <td
                      key={c.id}
                      className={[
                        "px-2 py-2 sm:px-3",
                        i > 1 ? "hidden md:table-cell" : "",
                        i === 0 ? "font-medium" : "",
                        c.internal ? "text-slate-600" : "",
                      ].join(" ")}
                      dir={c.dir === "ltr" ? "ltr" : undefined}
                    >
                      {r.data[c.id] != null && r.data[c.id] !== "" ? (
                        <CellDisplay value={r.data[c.id]} />
                      ) : c.internal ? (
                        "—"
                      ) : (
                        ""
                      )}
                      {i === 1 && (
                        <span className="block text-xs text-slate-400 md:hidden">
                          {columns
                            .slice(2)
                            .map((c2) => cellValue(r.data[c2.id]))
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="px-2 py-2 sm:px-3">
                    <div className="flex flex-wrap gap-1">
                      {r.exported ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">exported</span>
                      ) : (
                        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-600">new</span>
                      )}
                      {isDupe && (
                        <span className="rounded-full bg-yellow-200 px-2 py-0.5 text-xs font-medium text-yellow-800">dup</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        {filtered.length} shown of {rows.length} · click a row to view / edit internal fields
      </p>

      {exportIdsPending && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => !loading && setExportIdsPending(null)}
        >
          <div
            role="dialog"
            aria-labelledby="export-title"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="export-title" className="text-lg font-bold text-slate-900">
              Export columns
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Choose which columns to include in the CSV. {exportIdsPending.length} response
              {exportIdsPending.length === 1 ? "" : "s"} will be marked exported.
            </p>
            <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
              {exportColumnOptions.map((col) => (
                <label key={col.id} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={exportColumns.has(col.id)}
                    onChange={() => toggleExportColumn(col.id)}
                    className="h-4 w-4 accent-brand-primary"
                  />
                  {col.label}
                </label>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setExportIdsPending(null)}
                disabled={loading}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmExport()}
                disabled={loading || exportColumns.size === 0}
                className="clay-btn-primary px-3 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {loading ? "…" : "Download CSV"}
              </button>
            </div>
          </div>
        </div>
      )}

      {detailRow && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-900/40"
          onClick={closeDetail}
        >
          <div
            role="dialog"
            aria-labelledby="detail-title"
            className="flex h-full w-full max-w-md flex-col bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h3 id="detail-title" className="text-base font-bold text-slate-900">
                Response
              </h3>
              <button
                type="button"
                onClick={closeDetail}
                className="rounded-lg px-2 py-1 text-sm font-medium text-slate-500 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Submitted answers
                </p>
                <dl className="space-y-3">
                  {dataFields.map((f) => (
                    <div key={f.id}>
                      <dt className="text-xs font-medium text-slate-500">{f.label}</dt>
                      <dd className="mt-0.5 text-sm text-slate-900" dir={f.dir === "ltr" ? "ltr" : undefined}>
                        {detailRow.data[f.id] != null && detailRow.data[f.id] !== "" ? (
                          <CellDisplay value={detailRow.data[f.id]} />
                        ) : (
                          "—"
                        )}
                      </dd>
                    </div>
                  ))}
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Submitted</dt>
                    <dd className="mt-0.5 text-sm text-slate-900">
                      {new Date(detailRow.createdDate).toLocaleString()}
                    </dd>
                  </div>
                </dl>
              </section>

              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Internal fields
                </p>
                {internalFields.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    No internal fields on this form. Add them in Edit form → Settings.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {internalFields.map((f) => (
                      <div key={f.id}>
                        <label className="mb-1 block text-xs font-medium text-slate-500">{f.label}</label>
                        {f.type === "select" ? (
                          <select
                            value={draftInternal[f.id] ?? ""}
                            onChange={(e) => {
                              setDetailSaved(false);
                              setDraftInternal((prev) => ({ ...prev, [f.id]: e.target.value }));
                            }}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-primary/30"
                          >
                            <option value="">—</option>
                            {(f.options ?? []).map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <textarea
                            value={draftInternal[f.id] ?? ""}
                            onChange={(e) => {
                              setDetailSaved(false);
                              setDraftInternal((prev) => ({ ...prev, [f.id]: e.target.value }));
                            }}
                            rows={3}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-primary/30"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
            {internalFields.length > 0 && (
              <div className="space-y-2 border-t border-slate-200 px-4 py-3">
                {detailError && (
                  <p className="text-sm font-medium text-red-600">{detailError}</p>
                )}
                {detailSaved && !detailError && (
                  <p className="text-sm font-medium text-green-600">Saved</p>
                )}
                <button
                  type="button"
                  onClick={() => void saveInternal()}
                  disabled={detailSaving}
                  className="clay-btn-primary w-full px-3 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  {detailSaving ? "Saving…" : "Save internal fields"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
