/**
 * Spacing / overcrowding rules. A plant's footprint is its in-row spacing times
 * its row spacing (falling back to a square when row spacing is unknown). A bed
 * is overcrowded when the planned footprints exceed its area. Pure functions,
 * no I/O — this is plan-time conflict logic and must be easy to unit-test.
 */

export interface SpacedPlanting {
  plantName: string;
  quantity: number;
  spacingMm?: number | null;
  rowSpacingMm?: number | null;
}

export interface CapacityResult {
  areaSqM: number | null;
  /** Total footprint of plantings whose spacing is known, in m^2. */
  usedSqM: number;
  /** How much the used area exceeds the bed area (0 when within capacity). */
  overBy: number;
  over: boolean;
  /** Names of plants that lack spacing data and were left out of the sum. */
  unknown: string[];
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/** A single plant's footprint in m^2, or null when spacing is unknown. */
export function footprintSqM(spacingMm?: number | null, rowSpacingMm?: number | null): number | null {
  if (spacingMm == null || spacingMm <= 0) return null;
  const row = rowSpacingMm != null && rowSpacingMm > 0 ? rowSpacingMm : spacingMm;
  return (spacingMm / 1000) * (row / 1000);
}

/**
 * Sum the footprints of all plantings (footprint × quantity) and compare with
 * the bed area. Plants without spacing data are reported separately rather than
 * silently counted as zero. A null bed area means capacity can't be judged.
 */
export function evaluateCapacity(
  plantings: SpacedPlanting[],
  areaSqM: number | null,
): CapacityResult {
  let usedSqM = 0;
  const unknown: string[] = [];

  for (const p of plantings) {
    const foot = footprintSqM(p.spacingMm, p.rowSpacingMm);
    if (foot == null) {
      unknown.push(p.plantName);
      continue;
    }
    usedSqM += foot * Math.max(1, p.quantity);
  }

  usedSqM = round(usedSqM);
  const over = areaSqM != null && usedSqM > areaSqM;
  return {
    areaSqM,
    usedSqM,
    overBy: over ? round(usedSqM - areaSqM!) : 0,
    over,
    unknown,
  };
}
