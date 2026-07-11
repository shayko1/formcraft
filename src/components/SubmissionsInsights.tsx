import {
  buildChoiceBreakdowns,
  buildDailyCounts,
  completionRate,
} from "../lib/analytics";
import type { FieldConfig } from "../lib/form-schema";
import type { SubmissionRow } from "./SubmissionsPanel";

interface SubmissionsInsightsProps {
  fields: FieldConfig[];
  submissions: SubmissionRow[];
  viewCount: number;
  startCount: number;
  /** Total responses including ones hidden by free-tier cap. */
  totalResponses: number;
  newCount: number;
  exportedCount: number;
  duplicateCount: number;
  onSelectDuplicates?: () => void;
}

function KpiCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone: "slate" | "violet" | "mint" | "pink" | "orange" | "green" | "yellow";
}) {
  const tones: Record<typeof tone, string> = {
    slate: "bg-slate-50 ring-slate-200 text-slate-900",
    violet: "bg-[color-mix(in_srgb,var(--color-brand-primary)_18%,white)] ring-[color-mix(in_srgb,var(--color-brand-primary)_35%,white)] text-slate-900",
    mint: "bg-[color-mix(in_srgb,var(--color-brand-accent)_28%,white)] ring-[color-mix(in_srgb,var(--color-brand-accent)_45%,white)] text-slate-900",
    pink: "bg-[color-mix(in_srgb,var(--color-brand-secondary)_35%,white)] ring-[color-mix(in_srgb,var(--color-brand-secondary)_50%,white)] text-slate-900",
    orange: "bg-orange-50 ring-orange-200 text-orange-900",
    green: "bg-emerald-50 ring-emerald-200 text-emerald-900",
    yellow: "bg-amber-50 ring-amber-200 text-amber-900",
  };
  return (
    <div className={`rounded-2xl p-3.5 ring-1 ${tones[tone]}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 text-xs font-medium text-slate-500">{hint}</p>}
    </div>
  );
}

export default function SubmissionsInsights({
  fields,
  submissions,
  viewCount,
  startCount,
  totalResponses,
  newCount,
  exportedCount,
  duplicateCount,
  onSelectDuplicates,
}: SubmissionsInsightsProps) {
  const rate = completionRate(totalResponses, startCount, viewCount);
  const daily = buildDailyCounts(submissions, 14);
  const maxDay = Math.max(1, ...daily.map((d) => d.count));
  const choiceStats = buildChoiceBreakdowns(fields, submissions);
  const dayTotal = daily.reduce((s, d) => s + d.count, 0);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Overview</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          How this form is performing and what people are answering.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Views" value={viewCount} hint="Page opens" tone="violet" />
        <KpiCard label="Starts" value={startCount} hint="Began filling" tone="pink" />
        <KpiCard label="Responses" value={totalResponses} hint="Submitted" tone="mint" />
        <KpiCard
          label="Completion"
          value={rate == null ? "—" : `${rate}%`}
          hint={startCount > 0 ? "Of starts" : viewCount > 0 ? "Of views" : "Need traffic"}
          tone="slate"
        />
        <KpiCard label="New" value={newCount} hint="Not exported" tone="orange" />
        <KpiCard label="Exported" value={exportedCount} hint="Downloaded" tone="green" />
      </div>

      {duplicateCount > 0 && onSelectDuplicates && (
        <button
          type="button"
          onClick={onSelectDuplicates}
          className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-200"
        >
          {duplicateCount} duplicate{duplicateCount === 1 ? "" : "s"} detected — select them
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      )}

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Responses · last 14 days</h3>
            <p className="text-xs text-slate-500">
              {dayTotal === 0
                ? "No submissions in this window yet."
                : `${dayTotal} response${dayTotal === 1 ? "" : "s"} in the last two weeks.`}
            </p>
          </div>
        </div>
        <div className="mt-4 flex h-28 items-end gap-1 sm:gap-1.5">
          {daily.map((d) => (
            <div key={d.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span className="text-[10px] font-semibold text-slate-400">
                {d.count > 0 ? d.count : ""}
              </span>
              <div
                className="w-full rounded-t-md bg-[var(--color-brand-primary)]/80 transition"
                style={{ height: `${Math.max(d.count > 0 ? 8 : 2, (d.count / maxDay) * 100)}%` }}
                title={`${d.label}: ${d.count}`}
              />
              <span className="truncate text-[9px] font-medium text-slate-400">{d.label.replace(/ .*/, "")}</span>
            </div>
          ))}
        </div>
      </div>

      {choiceStats.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-800">Answer breakdown</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {choiceStats.map((stat) => (
              <div key={stat.fieldId} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-baseline justify-between gap-2">
                  <h4 className="text-sm font-bold text-slate-800">{stat.label}</h4>
                  <span className="text-xs text-slate-400">
                    {stat.totalAnswered} answer{stat.totalAnswered === 1 ? "" : "s"}
                  </span>
                </div>
                {stat.totalAnswered === 0 ? (
                  <p className="mt-3 text-xs text-slate-400">No answers yet.</p>
                ) : (
                  <ul className="mt-3 space-y-2.5">
                    {stat.options.map((o) => (
                      <li key={o.label}>
                        <div className="mb-1 flex justify-between gap-2 text-xs">
                          <span className="truncate font-medium text-slate-700">{o.label}</span>
                          <span className="shrink-0 font-semibold text-slate-500">
                            {o.count} · {o.pct}%
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-[var(--color-brand-primary)]"
                            style={{ width: `${o.pct}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
