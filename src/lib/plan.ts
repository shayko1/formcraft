import { auth, httpClient } from "@wix/essentials";
import { countPublishedByOwner } from "./forms";
import { countSubmissionsThisMonth } from "./submissions";

// Freemium limits. Pro is monthly and unlimited.
export type PlanTier = "free" | "pro";

export const LIMITS = {
  free: { maxPublishedForms: 1, maxSubmissionsPerMonth: 100 },
  pro: { maxPublishedForms: Infinity, maxSubmissionsPerMonth: Infinity },
} as const;

// The FormCraft Pro recurring plan (Wix Pricing Plans). €12/mo.
export const PRO_PLAN_ID = "eb231ba3-8ceb-4981-bc85-61b2d1f50fbb";

// Elevated authenticated fetch — lets this backend read ALL pricing-plan orders
// (admin scope) regardless of the calling identity, so we can resolve the OWNER's
// plan even from a public visitor's submit request. No @wix/pricing-plans SDK needed;
// we call the REST API directly.
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
  publishedForms: number;
  maxPublishedForms: number;
  submissionsThisMonth: number;
  maxSubmissionsPerMonth: number;
  canPublishMore: boolean;
  canAcceptSubmission: boolean;
}

export async function getQuotaStatus(ownerId: string): Promise<QuotaStatus> {
  const tier = await getPlanTier(ownerId);
  const limits = LIMITS[tier];
  const [publishedForms, submissionsThisMonth] = await Promise.all([
    countPublishedByOwner(ownerId),
    countSubmissionsThisMonth(ownerId),
  ]);
  return {
    tier,
    publishedForms,
    maxPublishedForms: limits.maxPublishedForms,
    submissionsThisMonth,
    maxSubmissionsPerMonth: limits.maxSubmissionsPerMonth,
    canPublishMore: publishedForms < limits.maxPublishedForms,
    canAcceptSubmission: submissionsThisMonth < limits.maxSubmissionsPerMonth,
  };
}

/** Lightweight submission-quota check for the public submit endpoint. */
export async function canAcceptSubmission(ownerId: string): Promise<boolean> {
  const tier = await getPlanTier(ownerId);
  if (LIMITS[tier].maxSubmissionsPerMonth === Infinity) return true;
  const count = await countSubmissionsThisMonth(ownerId);
  return count < LIMITS[tier].maxSubmissionsPerMonth;
}
