import { auth, httpClient } from "@wix/essentials";
import { countFormsByOwner } from "./forms";

// Freemium limits.
//  - maxForms: hard cap on how many forms an owner can CREATE (enforced client + server).
//  - visibleSubmissionsPerForm: how many responses the admin panel SHOWS. Responses are
//    ALWAYS collected and stored regardless; the free tier only hides the overflow.
export type PlanTier = "free" | "pro";

export const LIMITS = {
  free: { maxForms: 1, visibleSubmissionsPerForm: 100 },
  pro: { maxForms: Infinity, visibleSubmissionsPerForm: Infinity },
} as const;

// The FormCraft Pro recurring plan (Wix Pricing Plans). €12/mo.
export const PRO_PLAN_ID = "eb231ba3-8ceb-4981-bc85-61b2d1f50fbb";

// An order grants Pro only when it's live — NOT a DRAFT (abandoned/unpaid checkout).
const ACTIVE_ORDER_STATUSES = new Set(["ACTIVE", "PENDING"]);

// Admin orders read via elevation — reads ALL Pro orders (the member/orders endpoint
// returned 400 in this runtime). We then match the buyer to the member in code.
async function fetchProOrders(): Promise<Array<Record<string, unknown>>> {
  const elevatedFetch = auth.elevate(httpClient.fetchWithAuth);
  // NOTE: the admin ListOrders endpoint caps `limit` at 50 — passing 100 returns 400.
  const res = await elevatedFetch(
    `https://www.wixapis.com/pricing-plans/v2/orders?planIds=${PRO_PLAN_ID}&limit=50`,
  );
  if (!res.ok) return [];
  const body = (await res.json()) as { orders?: Array<Record<string, unknown>> };
  return body.orders ?? [];
}

function orderGrantsPro(o: Record<string, unknown>, memberId: string): boolean {
  const buyer = (o.buyer ?? {}) as { memberId?: string };
  const buyerMemberId = buyer.memberId ?? (o as { memberId?: string }).memberId;
  return buyerMemberId === memberId && ACTIVE_ORDER_STATUSES.has(String(o.status));
}

/**
 * Resolve a member's plan tier by checking their active Pro pricing-plan orders.
 * Any failure degrades safely to "free".
 */
export async function getPlanTier(memberId: string): Promise<PlanTier> {
  if (!memberId) return "free";
  try {
    const orders = await fetchProOrders();
    return orders.some((o) => orderGrantsPro(o, memberId)) ? "pro" : "free";
  } catch {
    return "free";
  }
}

export interface QuotaStatus {
  tier: PlanTier;
  forms: number;
  maxForms: number;
  canCreateForm: boolean;
  visibleSubmissionsPerForm: number;
}

export async function getQuotaStatus(ownerId: string): Promise<QuotaStatus> {
  const tier = await getPlanTier(ownerId);
  const limits = LIMITS[tier];
  const forms = await countFormsByOwner(ownerId);
  return {
    tier,
    forms,
    maxForms: limits.maxForms,
    canCreateForm: forms < limits.maxForms,
    visibleSubmissionsPerForm: limits.visibleSubmissionsPerForm,
  };
}

/** How many submissions the owner's tier is allowed to SEE (Infinity for Pro). */
export async function getVisibleSubmissionsLimit(ownerId: string): Promise<number> {
  const tier = await getPlanTier(ownerId);
  return LIMITS[tier].visibleSubmissionsPerForm;
}
