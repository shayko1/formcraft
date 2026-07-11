import type { FieldConfig } from "./form-schema";

export type TrackEvent = "view" | "start";

export interface DailyCount {
  /** YYYY-MM-DD (UTC) */
  date: string;
  /** Short label e.g. "Jul 3" */
  label: string;
  count: number;
}

export interface ChoiceOptionStat {
  label: string;
  count: number;
  pct: number;
}

export interface ChoiceFieldStat {
  fieldId: string;
  label: string;
  totalAnswered: number;
  options: ChoiceOptionStat[];
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function shortLabel(isoDay: string): string {
  const d = new Date(`${isoDay}T00:00:00.000Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Build a fixed last-N-days series (UTC), filling zeros for missing days. */
export function buildDailyCounts(
  rows: { createdDate: string }[],
  days = 14,
  now = new Date(),
): DailyCount[] {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    keys.push(dayKey(d));
  }
  const counts = new Map(keys.map((k) => [k, 0]));
  for (const r of rows) {
    if (!r.createdDate) continue;
    const k = dayKey(new Date(r.createdDate));
    if (counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return keys.map((date) => ({
    date,
    label: shortLabel(date),
    count: counts.get(date) ?? 0,
  }));
}

/** Completion rate: submissions/starts, else submissions/views, else null. */
export function completionRate(
  submissions: number,
  starts: number,
  views: number,
): number | null {
  if (starts > 0) return Math.min(100, Math.round((submissions / starts) * 100));
  if (views > 0) return Math.min(100, Math.round((submissions / views) * 100));
  return null;
}

function cellValue(v: unknown): string {
  if (v == null) return "";
  return Array.isArray(v) ? v.join(", ") : String(v);
}

/** Answer distribution for select / radio / checkbox fields. */
export function buildChoiceBreakdowns(
  fields: FieldConfig[],
  rows: { data: Record<string, unknown> }[],
): ChoiceFieldStat[] {
  const choiceFields = fields.filter(
    (f) => (f.type === "select" || f.type === "radio" || f.type === "checkbox") && (f.options?.length ?? 0) > 0,
  );
  return choiceFields.map((f) => {
    const optionCounts = new Map((f.options ?? []).map((o) => [o, 0]));
    let totalAnswered = 0;
    for (const r of rows) {
      const raw = r.data[f.id];
      if (raw == null || raw === "") continue;
      const values = Array.isArray(raw)
        ? raw.map(String)
        : f.type === "checkbox"
          ? cellValue(raw)
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [String(raw)];
      if (values.length === 0) continue;
      totalAnswered += 1;
      for (const v of values) {
        if (optionCounts.has(v)) optionCounts.set(v, (optionCounts.get(v) ?? 0) + 1);
      }
    }
    const options: ChoiceOptionStat[] = [...optionCounts.entries()].map(([label, count]) => ({
      label,
      count,
      pct: totalAnswered > 0 ? Math.round((count / totalAnswered) * 100) : 0,
    }));
    return { fieldId: f.id, label: f.label, totalAnswered, options };
  });
}
