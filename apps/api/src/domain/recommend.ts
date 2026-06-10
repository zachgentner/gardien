/**
 * Per-bed plant recommendations from rotation history. Recommends what to grow
 * in a bed next: prefer the feeder type that best follows the last crop (heavy
 * feeders -> nitrogen-fixers -> light feeders, etc.), exclude family-rotation
 * violations, and only suggest plants that suit the zone. Pure functions over
 * plain data, no I/O. Family-aware; the caller may override.
 */
import { FeederType } from '@gardien/shared';
import { checkRotation, recommendNextFeeder, type BedHistoryEntry } from './rotation.js';

export interface RecommendCandidate {
  id: string;
  name: string;
  familyId: string | null;
  feederType?: FeederType | null;
  /** Whether the plant has a planting window for the target zone. */
  suitable: boolean;
}

export interface Recommendation {
  plantId: string;
  name: string;
  reason: string;
  /** Lower is better; drives ordering. */
  score: number;
}

export interface RecommendOptions {
  /** Rotation gap (seasons) before a family may return; defaults to rotation's. */
  minGap?: number;
  /** Cap on how many recommendations to return. */
  limit?: number;
}

/** The feeder type of the most recent crop in the bed, if any. */
function lastFeeder(
  history: BedHistoryEntry[],
  before: number,
): FeederType | null {
  let recent = -Infinity;
  let feeder: FeederType | null = null;
  for (const h of history) {
    if (h.sequence >= before) continue;
    if (h.sequence > recent) {
      recent = h.sequence;
      feeder = h.feederType ?? null;
    }
  }
  return feeder;
}

function reasonFor(candidate: FeederType | null | undefined, previous: FeederType | null): string {
  if (candidate === FeederType.Fixer) {
    return previous === FeederType.Heavy || previous === FeederType.Medium
      ? 'Nitrogen-fixer — restores soil after a hungry crop.'
      : 'Nitrogen-fixer — builds soil for next season.';
  }
  if (candidate === FeederType.Heavy) {
    return previous === FeederType.Fixer || previous === FeederType.Light
      ? 'Heavy feeder — makes use of the soil a light crop or legume built up.'
      : 'Heavy feeder.';
  }
  if (candidate === FeederType.Light) return 'Light feeder — an easy follow-on crop.';
  if (previous === null) return 'A solid choice with no recent history to avoid.';
  return 'Good rotation fit for this bed.';
}

/**
 * Rank candidate plants for a bed about to be planted at `candidateSequence`.
 * Excludes rotation violations and zone-unsuitable plants; orders the rest by
 * how well their feeder type follows the bed's last crop.
 */
export function recommendForBed(
  history: BedHistoryEntry[],
  candidateSequence: number,
  candidates: RecommendCandidate[],
  options: RecommendOptions = {},
): Recommendation[] {
  const previous = lastFeeder(history, candidateSequence);
  const preferred = recommendNextFeeder(previous);
  const rank = new Map(preferred.map((f, i) => [f, i]));

  const out: Recommendation[] = [];
  for (const c of candidates) {
    if (!c.suitable) continue;
    if (checkRotation(history, c.familyId, candidateSequence, { minGap: options.minGap }).violated) {
      continue;
    }
    // Feeders earlier in the preference list score better; unknown feeders sit
    // just after the known ones.
    const score = c.feederType != null ? (rank.get(c.feederType) ?? preferred.length) : preferred.length + 1;
    out.push({ plantId: c.id, name: c.name, reason: reasonFor(c.feederType, previous), score });
  }

  out.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
  return options.limit != null ? out.slice(0, options.limit) : out;
}
