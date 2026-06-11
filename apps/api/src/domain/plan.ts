/**
 * Subscription plan limits (Phase 8). Pure lookup so usage enforcement is
 * testable and centralised. Billing (charging for `pro`) is a later,
 * provider-dependent step; these limits already gate usage today.
 */

export type Plan = 'free' | 'pro';
export type LimitedResource = 'gardens' | 'devices';

const LIMITS: Record<Plan, Record<LimitedResource, number>> = {
  free: { gardens: 3, devices: 2 },
  pro: { gardens: Infinity, devices: Infinity },
};

export function planLimit(plan: Plan, resource: LimitedResource): number {
  return LIMITS[plan][resource];
}

/** Whether a new resource may be created given how many already exist. */
export function withinLimit(plan: Plan, resource: LimitedResource, currentCount: number): boolean {
  return currentCount < planLimit(plan, resource);
}
