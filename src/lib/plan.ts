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

// Elevated authenticated fetch — lets this backend read ALL pricing-plan orders
// (admin scope) regardless of the calling identity. No @wix/pricing-plans SDK needed.
const elevatedFetch = auth.elevate(httpClient.fetchWithAuth);

/**
 * Resolve a member's plan tier by checking their active Pro pricing-plan orders.
 * Works from any request context (dashboard = owner session, submit = visitor).
 * Any failure degrades safely to "free".
 */
export async function getPlanTier(memberId: string): Promise<PlanTier> {
  if (!memberId) return "free";
  try {
    const url =
      `https://www.wixapis.com/pricing-plans/v2/orders` +
      `?planIds=${PRO_PLAN_ID}&orderStatuses=ACTIVE&orderStatuses=PENDING&limit=100`;
    const res = await elevatedFetch(url);
    if (!res.ok) return "free";
    const body = (await res.json()) as { orders?: Array<Record<string, unknown>> };
    const orders = body.orders ?? [];
    const isPro = orders.some((o) => {
      const buyer = (o.buyer ?? {}) as { memberId?: string };
      return buyer.memberId === memberId || (o as { memberId?: string }).memberId === memberId;
    });
    return isPro ? "pro" : "free";
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
