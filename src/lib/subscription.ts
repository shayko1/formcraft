import { orders } from "@wix/pricing-plans";
import { auth, httpClient } from "@wix/essentials";
import { PRO_PLAN_ID } from "./plan";

export type SubscriptionOrderView = {
  id: string;
  planName: string;
  status: string;
  planPrice: string;
  currency: string;
  lastPaymentStatus: string | null;
  startDate: string | null;
  endDate: string | null;
  currentCycleEnd: string | null;
  autoRenewCanceled: boolean;
  createdDate: string | null;
  /** True when Pro benefits still apply (ACTIVE/PENDING within dates, or canceled but before end). */
  grantsAccess: boolean;
};

export type SubscriptionSummary = {
  tier: "free" | "pro";
  activeOrder: SubscriptionOrderView | null;
  orders: SubscriptionOrderView[];
  /** Billing history rows derived from orders (not PDF invoices). */
  invoices: Array<{
    id: string;
    label: string;
    amount: string;
    status: string;
    date: string | null;
  }>;
};

function asRecord(o: unknown): Record<string, unknown> {
  return (o && typeof o === "object" ? o : {}) as Record<string, unknown>;
}

function orderId(o: Record<string, unknown>): string {
  return String(o._id ?? o.id ?? "");
}

function isWithinAccessWindow(o: Record<string, unknown>, now = Date.now()): boolean {
  const status = String(o.status ?? "");
  if (status === "ACTIVE" || status === "PENDING") return true;
  // Canceled / ended may still grant access until endDate (end-of-period cancel).
  if (status === "CANCELED" || o.autoRenewCanceled) {
    const end = o.endDate ? Date.parse(String(o.endDate)) : NaN;
    return Number.isFinite(end) && end > now;
  }
  return false;
}

function mapOrder(raw: unknown): SubscriptionOrderView | null {
  const o = asRecord(raw);
  const id = orderId(o);
  if (!id) return null;
  const cycle = asRecord(o.currentCycle);
  const priceDetails = asRecord(o.priceDetails);
  const planPrice = String(o.planPrice ?? priceDetails.planPrice ?? priceDetails.total ?? "—");
  const currency = String(priceDetails.currency ?? "EUR");
  return {
    id,
    planName: String(o.planName ?? "FormCraft Pro"),
    status: String(o.status ?? "UNKNOWN"),
    planPrice,
    currency,
    lastPaymentStatus: o.lastPaymentStatus != null ? String(o.lastPaymentStatus) : null,
    startDate: o.startDate != null ? String(o.startDate) : null,
    endDate: o.endDate != null ? String(o.endDate) : null,
    currentCycleEnd: cycle.endedDate != null ? String(cycle.endedDate) : null,
    autoRenewCanceled: Boolean(o.autoRenewCanceled),
    createdDate: o._createdDate != null ? String(o._createdDate) : o.createdDate != null ? String(o.createdDate) : null,
    grantsAccess: isWithinAccessWindow(o),
  };
}

async function listViaMemberSdk(): Promise<unknown[]> {
  const res = await orders.memberListOrders({
    planIds: [PRO_PLAN_ID],
    limit: 50,
  });
  return (res as { orders?: unknown[] }).orders ?? [];
}

/** Elevated admin list filtered to this member — fallback if memberListOrders fails. */
async function listViaElevated(memberId: string): Promise<unknown[]> {
  const elevatedFetch = auth.elevate(httpClient.fetchWithAuth);
  const res = await elevatedFetch(
    `https://www.wixapis.com/pricing-plans/v2/orders?planIds=${PRO_PLAN_ID}&limit=50`,
  );
  if (!res.ok) return [];
  const body = (await res.json()) as { orders?: Array<Record<string, unknown>> };
  return (body.orders ?? []).filter((o) => {
    const buyer = asRecord(o.buyer);
    return String(buyer.memberId ?? o.memberId ?? "") === memberId;
  });
}

export async function getSubscriptionSummary(memberId: string): Promise<SubscriptionSummary> {
  if (!memberId) {
    return { tier: "free", activeOrder: null, orders: [], invoices: [] };
  }

  let raw: unknown[] = [];
  try {
    raw = await listViaMemberSdk();
  } catch {
    try {
      raw = await listViaElevated(memberId);
    } catch {
      raw = [];
    }
  }

  const mapped = raw.map(mapOrder).filter((o): o is SubscriptionOrderView => o != null);
  mapped.sort((a, b) => {
    const da = a.createdDate ? Date.parse(a.createdDate) : 0;
    const db = b.createdDate ? Date.parse(b.createdDate) : 0;
    return db - da;
  });

  const activeOrder =
    mapped.find((o) => o.grantsAccess && (o.status === "ACTIVE" || o.status === "PENDING")) ??
    mapped.find((o) => o.grantsAccess) ??
    null;

  const invoices = mapped
    .filter((o) => o.status !== "DRAFT")
    .map((o) => ({
      id: o.id,
      label: `${o.planName} · ${o.status}`,
      amount: o.planPrice !== "—" ? `${o.planPrice} ${o.currency}` : "—",
      status: o.lastPaymentStatus ?? o.status,
      date: o.currentCycleEnd ?? o.startDate ?? o.createdDate,
    }));

  return {
    tier: activeOrder ? "pro" : "free",
    activeOrder,
    orders: mapped,
    invoices,
  };
}

/**
 * Cancel at next payment date (end of period). Member-authenticated — no elevate.
 */
export async function cancelSubscriptionAtPeriodEnd(orderId: string): Promise<void> {
  await orders.requestCancellation(orderId, "NEXT_PAYMENT_DATE");
}

/** Verify the order belongs to the member before cancel (defense in depth). */
export async function memberOwnsOrder(memberId: string, orderId: string): Promise<boolean> {
  const summary = await getSubscriptionSummary(memberId);
  return summary.orders.some((o) => o.id === orderId);
}
