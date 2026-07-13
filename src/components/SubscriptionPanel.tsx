import { useState } from "react";
import UpgradeButton from "./UpgradeButton";
import type { SubscriptionSummary } from "../lib/subscription";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function SubscriptionPanel({ summary }: { summary: SubscriptionSummary }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const active = summary.activeOrder;

  const cancel = async () => {
    if (!active) return;
    const ok = window.confirm(
      "Cancel FormCraft Pro at the end of your current billing period? You’ll keep Pro until then, and won’t be charged again.",
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: active.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.message ?? "Could not cancel. Please try again.");
        setBusy(false);
        return;
      }
      setDone(true);
      setBusy(false);
      window.location.reload();
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  };

  const renewing =
    active &&
    !active.autoRenewCanceled &&
    (active.status === "ACTIVE" || active.status === "PENDING");

  return (
    <div className="space-y-8">
      {/* Status */}
      <section className="clay-card border border-slate-100 bg-white p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Current plan</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-extrabold text-slate-900">
              {summary.tier === "pro" ? "FormCraft Pro" : "Free"}
            </h2>
            <p className="mt-2 text-sm font-semibold text-slate-500">
              {summary.tier === "pro"
                ? "Unlimited forms and responses"
                : "1 form · up to 100 visible responses per form"}
            </p>
            {active && (
              <p className="mt-3 text-sm text-slate-600">
                Status: <span className="font-bold">{active.status}</span>
                {active.autoRenewCanceled || done ? (
                  <>
                    {" "}
                    · Cancels{" "}
                    <span className="font-bold">
                      {formatDate(active.endDate ?? active.currentCycleEnd)}
                    </span>
                    {" "}(end of period)
                  </>
                ) : active.endDate || active.currentCycleEnd ? (
                  <>
                    {" "}
                    · Renews / period ends{" "}
                    <span className="font-bold">
                      {formatDate(active.endDate ?? active.currentCycleEnd)}
                    </span>
                  </>
                ) : null}
                {active.planPrice !== "—" && (
                  <>
                    {" "}
                    · {active.planPrice} {active.currency}/mo
                  </>
                )}
              </p>
            )}
          </div>
          <div className="w-full max-w-xs sm:w-auto">
            {summary.tier === "free" ? (
              <UpgradeButton label="Upgrade to Pro" className="clay-btn-primary px-6 py-3 text-sm font-bold" />
            ) : renewing ? (
              <button
                type="button"
                onClick={() => void cancel()}
                disabled={busy}
                className="w-full rounded-xl border border-red-200 bg-white px-5 py-3 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
              >
                {busy ? "Canceling…" : "Cancel at period end"}
              </button>
            ) : (
              <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
                Cancellation scheduled — Pro stays active until period end.
              </p>
            )}
          </div>
        </div>
        {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
      </section>

      {/* Invoices / billing history */}
      <section>
        <h3 className="mb-3 text-lg font-extrabold text-slate-900">Billing history</h3>
        <p className="mb-4 text-sm text-slate-500">
          Payment records from your Pro orders. Formal PDF invoices are issued by your payment provider when available.
        </p>
        {summary.invoices.length === 0 ? (
          <div className="clay-card border border-dashed border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-400">
            No billing history yet. Upgrade to Pro to start a subscription.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Payment</th>
                </tr>
              </thead>
              <tbody>
                {summary.invoices.map((row) => (
                  <tr key={row.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-3 font-medium text-slate-600">{formatDate(row.date)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{row.label}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{row.amount}</td>
                    <td className="px-4 py-3 text-slate-600">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
