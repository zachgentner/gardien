/**
 * Bed geometry and planting-history rules. Pure functions, no I/O — the bed
 * detail view and bed create/update routes share them so the same logic is
 * unit-tested once.
 */

export type PlantingStatus = 'planned' | 'planted' | 'harvested' | 'removed';

/** Statuses that count as a bed's *current* occupancy vs. past history. */
const CURRENT_STATUSES: ReadonlySet<PlantingStatus> = new Set(['planned', 'planted']);

/** Derive a bed's area (m^2) from millimetre dimensions when both are present. */
export function deriveAreaSqM(
  lengthMm?: number | null,
  widthMm?: number | null,
): number | undefined {
  if (lengthMm == null || widthMm == null) return undefined;
  return (lengthMm / 1000) * (widthMm / 1000);
}

/**
 * Split a bed's plantings into what is currently growing/planned vs. past
 * history. "Current" is anything still planned or in the ground; once a
 * planting is harvested or removed it becomes history. Input order is
 * preserved within each group so callers control sorting.
 */
export function partitionPlantings<T extends { status: PlantingStatus }>(
  plantings: T[],
): { current: T[]; history: T[] } {
  const current: T[] = [];
  const history: T[] = [];
  for (const p of plantings) {
    (CURRENT_STATUSES.has(p.status) ? current : history).push(p);
  }
  return { current, history };
}
