import { describe, it, expect } from 'vitest';
import { FeederType } from '@gardien/shared';
import { recommendForBed, type RecommendCandidate } from '../src/domain/recommend.js';
import type { BedHistoryEntry } from '../src/domain/rotation.js';

const candidates: RecommendCandidate[] = [
  { id: 'bean', name: 'Bush Bean', familyId: 'fabaceae', feederType: FeederType.Fixer, suitable: true },
  { id: 'tomato', name: 'Tomato', familyId: 'solanaceae', feederType: FeederType.Heavy, suitable: true },
  { id: 'carrot', name: 'Carrot', familyId: 'apiaceae', feederType: FeederType.Light, suitable: true },
  { id: 'kale', name: 'Kale', familyId: 'brassicaceae', feederType: FeederType.Heavy, suitable: false },
];

describe('recommendForBed', () => {
  it('prefers nitrogen-fixers after a heavy feeder', () => {
    const history: BedHistoryEntry[] = [
      { sequence: 0, familyId: 'solanaceae', feederType: FeederType.Heavy },
    ];
    const recs = recommendForBed(history, 1, candidates);
    expect(recs[0]?.plantId).toBe('bean');
    expect(recs[0]?.reason).toMatch(/nitrogen-fixer/i);
  });

  it('excludes zone-unsuitable plants', () => {
    const recs = recommendForBed([], 1, candidates);
    expect(recs.map((r) => r.plantId)).not.toContain('kale');
  });

  it('excludes a family that violates the rotation gap', () => {
    // Tomato (solanaceae) grown last season — too soon to return.
    const history: BedHistoryEntry[] = [
      { sequence: 0, familyId: 'solanaceae', feederType: FeederType.Heavy },
    ];
    const recs = recommendForBed(history, 1, candidates, { minGap: 3 });
    expect(recs.map((r) => r.plantId)).not.toContain('tomato');
  });

  it('applies the default rotation gap when none is passed', () => {
    const history: BedHistoryEntry[] = [
      { sequence: 0, familyId: 'solanaceae', feederType: FeederType.Heavy },
    ];
    const recs = recommendForBed(history, 1, candidates);
    expect(recs.map((r) => r.plantId)).not.toContain('tomato');
  });

  it('respects the limit', () => {
    const recs = recommendForBed([], 1, candidates, { limit: 1 });
    expect(recs).toHaveLength(1);
  });

  it('returns every suitable, non-conflicting plant when there is no history', () => {
    const recs = recommendForBed([], 1, candidates);
    expect(recs.map((r) => r.plantId).sort()).toEqual(['bean', 'carrot', 'tomato']);
  });
});
