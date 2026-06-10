import { describe, it, expect } from 'vitest';
import { FeederType } from '@gardien/shared';
import {
  checkRotation,
  recommendNextFeeder,
  type BedHistoryEntry,
} from '../src/domain/rotation.js';

describe('checkRotation', () => {
  const history: BedHistoryEntry[] = [
    { sequence: 1, familyId: 'nightshade' },
    { sequence: 2, familyId: 'brassica' },
    { sequence: 3, familyId: 'legume' },
  ];

  it('flags replanting the same family too soon', () => {
    const result = checkRotation(history, 'brassica', 4, { minGap: 3 });
    expect(result.violated).toBe(true);
    expect(result.lastSeasonsAgo).toBe(2);
    expect(result.message).toContain('rotate');
  });

  it('allows replanting once the gap is satisfied', () => {
    const result = checkRotation(history, 'nightshade', 5, { minGap: 3 });
    expect(result.violated).toBe(false);
    expect(result.lastSeasonsAgo).toBe(4);
  });

  it('treats a never-grown family as safe', () => {
    const result = checkRotation(history, 'cucurbit', 4);
    expect(result.violated).toBe(false);
    expect(result.lastSeasonsAgo).toBeUndefined();
  });

  it('never warns on unknown (null) family', () => {
    const result = checkRotation(history, null, 4, { minGap: 99 });
    expect(result.violated).toBe(false);
  });

  it('ignores future/equal sequences, only looking backwards', () => {
    const withFuture: BedHistoryEntry[] = [
      { sequence: 5, familyId: 'brassica' },
      { sequence: 4, familyId: 'brassica' },
    ];
    const result = checkRotation(withFuture, 'brassica', 4, { minGap: 3 });
    expect(result.violated).toBe(false);
  });
});

describe('recommendNextFeeder', () => {
  it('follows heavy feeders with nitrogen-fixers first', () => {
    expect(recommendNextFeeder(FeederType.Heavy)[0]).toBe(FeederType.Fixer);
  });

  it('follows fixers with heavy feeders first', () => {
    expect(recommendNextFeeder(FeederType.Fixer)[0]).toBe(FeederType.Heavy);
  });

  it('returns a full ranked list when there is no history', () => {
    expect(recommendNextFeeder(null)).toHaveLength(4);
    expect(recommendNextFeeder(undefined)[0]).toBe(FeederType.Fixer);
  });
});
