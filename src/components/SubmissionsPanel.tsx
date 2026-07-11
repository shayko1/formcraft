import { useMemo, useState } from "react";
import {
  type FieldConfig,
  isNameField,
  isPhoneField,
} from "../lib/form-schema";

export interface SubmissionRow {
  id: string;
  data: Record<string, unknown>;
  exported: boolean;
  createdDate: string;
}

interface SubmissionsPanelProps {
  formId: string;
  fields: FieldConfig[];
  submissions: SubmissionRow[];
}

type Filter = "all" | "new" | "exported";

function cellValue(v: unknown): string {
  if (v == null) return "";
  return Array.isArray(v) ? v.join(", ") : String(v);
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

export default function SubmissionsPanel({ formId, fields, submissions }: SubmissionsPanelProps) {
  const [rows, setRows] = useState<SubmissionRow[]>(submissions);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const duplicateIds = useMemo(() => findDuplicateIds(fields, rows), [fields, rows]);

  const filterBase =
    filter === "new" ? rows.filter((r) => !r.exported) :
    filter === "exported" ? rows.filter((r) => r.exported) : rows;

  const filtered = search
    ? filterBase.filter((r) => {
        const q = search.toLowerCase();
        return fields.some((f) => cellValue(r.data[f.id]).toLowerCase().includes(q));
      })
    : filterBase;

  const filteredIds = filtered.map((r) => r.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  const selectedInView = filteredIds.filter((id) => selected.has(id));

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

  const callApi = async (url: string, body: object) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Error ${res.status}`);
    return res;
  };

  const handleExport = async () => {
    if (selectedInView.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await callApi("/api/submissions/export", { formId, ids: selectedInView });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), { href: url, download: `responses.csv` });
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setRows((prev) =>
        prev.map((r) => (selectedInView.includes(r.id) ? { ...r, exported: true } : r)),
      );
      setSelected(new Set());
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
      setRows((prev) => prev.filter((r) => !selectedInView.includes(r.id)));
      setSelected(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    total: rows.length,
    fresh: rows.filter((r) => !r.exported).length,
    exported: rows.filter((r) => r.exported).length,
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
        filter === f ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50",
      ].join(" ")}
    >
      {label}
    </button>
  );

  // Show up to 4 fields as columns on desktop; the rest collapse into the first on mobile.
  const columns = fields;

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="rounded-full bg-slate-100 px-3 py-1 font-medium">Total: {stats.total}</span>
        <span className="rounded-full bg-orange-100 px-3 py-1 font-medium text-orange-700">New: {stats.fresh}</span>
        <span className="rounded-full bg-green-100 px-3 py-1 font-medium text-green-700">Exported: {stats.exported}</span>
        {duplicateIds.size > 0 && (
          <button
            onClick={selectDuplicates}
            className="flex items-center gap-1 rounded-full bg-yellow-100 px-3 py-1 font-medium text-yellow-700 transition hover:bg-yellow-200"
          >
            Duplicates: {duplicateIds.size} <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-chevron-right"><path d="m9 18 6-6-6-6"/></svg> select
          </button>
        )}
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setSelected(new Set());
        }}
        placeholder="Search responses…"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-300"
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {filterBtn("all", "All")}
          {filterBtn("new", "New")}
          {filterBtn("exported", "Exported")}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExport}
            disabled={loading || selectedInView.length === 0}
            className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? "…" : `Export CSV (${selectedInView.length})`}
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
                <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 accent-brand-600" />
              </th>
              {columns.map((c, i) => (
                <th
                  key={c.id}
                  className={["px-2 py-2 text-start sm:px-3", i > 1 ? "hidden md:table-cell" : ""].join(" ")}
                >
                  {c.label}
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
                  onClick={() => toggleOne(r.id)}
                  className={[
                    "cursor-pointer transition",
                    selected.has(r.id) ? "bg-brand-50" : isDupe ? "bg-yellow-50 hover:bg-yellow-100" : "hover:bg-slate-50",
                  ].join(" ")}
                >
                  <td className="px-2 py-2 sm:px-3">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggleOne(r.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 accent-brand-600"
                    />
                  </td>
                  {columns.map((c, i) => (
                    <td
                      key={c.id}
                      className={["px-2 py-2 sm:px-3", i > 1 ? "hidden md:table-cell" : "", i === 0 ? "font-medium" : ""].join(" ")}
                      dir={c.dir === "ltr" ? "ltr" : undefined}
                    >
                      {cellValue(r.data[c.id])}
                      {i === 1 && (
                        <span className="block text-xs text-slate-400 md:hidden">
                          {columns.slice(2).map((c2) => cellValue(r.data[c2.id])).filter(Boolean).join(" · ")}
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
        {filtered.length} shown of {rows.length}
      </p>
    </div>
  );
}
