import { countPublishedByOwner } from "./forms";
import { countSubmissionsThisMonth } from "./submissions";

// Freemium limits. Pro is monthly and unlimited.
export type PlanTier = "free" | "pro";

export const LIMITS = {
  free: { maxPublishedForms: 1, maxSubmissionsPerMonth: 100 },
  pro: { maxPublishedForms: Infinity, maxSubmissionsPerMonth: Infinity },
} as const;

/**
 * Resolve a member's plan tier.
 *
 * v1 detects Pro via a Wix Pricing Plans membership. Until a paid plan product is
 * configured in the Wix dashboard, this resolves to "free" and the free limits are
 * enforced. Wiring point: query the member's active plan orders here and return "pro"
 * when an active paid order exists. Any failure degrades safely to "free".
 */
export async function getPlanTier(_ownerId: string): Promise<PlanTier> {
  return "free";
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
