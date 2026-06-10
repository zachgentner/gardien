/**
 * Crop-rotation rules. Rotation logic operates at the plant-FAMILY level: you
 * should not follow a family with itself too soon, and heavy feeders are best
 * followed by soil-enriching legumes. Pure functions, no I/O.
 */
import { FeederType } from '@gardien/shared';

/**
 * One past planting in a bed. `sequence` is a monotonically increasing index
 * across that bed's seasons (higher = more recent), so the rules don't need to
 * parse dates.
 */
export interface BedHistoryEntry {
  sequence: number;
  familyId: string | null;
  feederType?: FeederType | null;
}

export interface RotationOptions {
  /** Minimum number of seasons that must pass before replanting a family. */
  minGap: number;
}

export interface RotationCheck {
  violated: boolean;
  /** How many sequences ago the same family last appeared, if it did. */
  lastSeasonsAgo?: number;
  message?: string;
}

const DEFAULT_OPTIONS: RotationOptions = { minGap: 3 };

/**
 * Decide whether planting `candidateFamilyId` at `candidateSequence` violates
 * the rotation gap, given the bed's history. A null family (unknown) never
 * triggers a violation — we don't warn on data we don't have.
 */
export function checkRotation(
  history: BedHistoryEntry[],
  candidateFamilyId: string | null,
  candidateSequence: number,
  options: Partial<RotationOptions> = {},
): RotationCheck {
  // Use `??` rather than a spread so an explicit `{ minGap: undefined }` from a
  // caller falls back to the default instead of disabling the check.
  const minGap = options.minGap ?? DEFAULT_OPTIONS.minGap;
  if (candidateFamilyId === null) return { violated: false };

  let mostRecent = -Infinity;
  for (const entry of history) {
    if (entry.familyId !== candidateFamilyId) continue;
    if (entry.sequence >= candidateSequence) continue; // only look backwards
    if (entry.sequence > mostRecent) mostRecent = entry.sequence;
  }

  if (mostRecent === -Infinity) return { violated: false };

  const gap = candidateSequence - mostRecent;
  const violated = gap <= minGap;
  return {
    violated,
    lastSeasonsAgo: gap,
    message: violated
      ? `Same plant family was grown here ${gap} season(s) ago; rotate after at least ${minGap}.`
      : undefined,
  };
}

/**
 * Recommend which feeder types make good successors to the last crop, to keep
 * soil healthy: follow heavy feeders with nitrogen-fixers, follow fixers with
 * heavy feeders, etc. Returned best-first.
 */
export function recommendNextFeeder(lastFeeder: FeederType | null | undefined): FeederType[] {
  switch (lastFeeder) {
    case FeederType.Heavy:
      return [FeederType.Fixer, FeederType.Light];
    case FeederType.Medium:
      return [FeederType.Fixer, FeederType.Light, FeederType.Medium];
    case FeederType.Light:
      return [FeederType.Heavy, FeederType.Medium];
    case FeederType.Fixer:
      return [FeederType.Heavy, FeederType.Medium];
    default:
      // No history — anything goes, but bias toward soil-builders first.
      return [FeederType.Fixer, FeederType.Light, FeederType.Medium, FeederType.Heavy];
  }
}
